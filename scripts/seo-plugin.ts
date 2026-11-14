import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { loadEnv, type Plugin, type ResolvedConfig } from "vite";
import { publicCatalogConfig } from "../src/config/catalog";
import { categoryPath, homeSeo, listingSeo, privateSeo, productPath, productSeo, sitemapXml, staticHead, escapeXml, type SeoData } from "../src/lib/seo";
import type { Category, Product } from "../src/types/catalog";

const SELECT = "id,name,slug,description,category_id,brand_id,is_active,type,categories(id,name,slug),brands(id,name),product_variants(id,product_id,name,flavor,size,price,original_price,image_url,stock)";

/** Anonymous read-only catalog access, paginated to avoid API row limits. */
export async function fetchPublicRows<T>(table: string, select: string, config: { url: string; key: string }): Promise<T[]> {
  const rows: T[] = [];
  const limit = 500;
  for (let offset = 0; ; offset += limit) {
    const url = new URL(`/rest/v1/${table}`, config.url);
    url.searchParams.set("select", select);
    url.searchParams.set("order", "id.asc");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    if (table === "products") url.searchParams.set("is_active", "eq.true");
    const response = await fetch(url, { headers: { apikey: config.key, Authorization: `Bearer ${config.key}` }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`SEO: public ${table} request failed (${response.status}). Check public catalog access and VITE_ variables.`);
    const batch = await response.json() as T[];
    rows.push(...batch);
    if (batch.length < limit) return rows;
  }
}

export function replaceSeoHead(html: string, seo: SeoData) {
  // Vite removes HTML comments: remove only owned SEO tags rather than relying on markers.
  return html.replace(/<head>([\s\S]*?)<\/head>/i, (_, head: string) => {
    const clean = head
      .replace(/<!-- seo:(start|end) -->/g, "")
      .replace(/<title>[\s\S]*?<\/title>/gi, "")
      .replace(/<meta\b[^>]*(?:name=["'](?:description|robots|twitter:[^"']*)["']|property=["']og:[^"']*["'])[^>]*>/gi, "")
      .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, "")
      .replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "");
    return `<head>${clean}\n${staticHead(seo)}\n</head>`;
  });
}

export function seoPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "ojuara-public-seo", apply: "build",
    configResolved(resolved) { config = resolved; },
    async closeBundle() {
      if (config.command !== "build" || config.build.ssr) return;
      const env = { ...loadEnv(config.mode, config.root, "VITE_"), ...process.env };
      const catalog = publicCatalogConfig(env);
      const [products, categories] = await Promise.all([
        fetchPublicRows<Product>("products", SELECT, catalog), fetchPublicRows<Category>("categories", "id,name,slug,description", catalog),
      ]);
      const out = resolve(config.root, config.build.outDir);
      const html = await readFile(resolve(out, "index.html"), "utf8");
      const paths = ["/", "/produtos", "/produtos?tipo=offer", "/produtos?tipo=kit", ...categories.map((c) => categoryPath(c.slug)), ...products.map((p) => productPath(p.slug))];
      const links = products.map((p) => `<li><a href="${escapeXml(productPath(p.slug))}">${escapeXml(p.name)}</a></li>`).join("");
      const categoryLinks = categories.map((c) => `<li><a href="${escapeXml(categoryPath(c.slug))}">${escapeXml(c.name)}</a></li>`).join("");
      const fallback = `<noscript><nav aria-label="Catálogo"><a href="/produtos">Produtos</a><ul>${categoryLinks}${links}</ul></nav></noscript>`;
      const writePage = async (file: string, seo: SeoData, content = "") => {
        const destination = resolve(out, file);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, replaceSeoHead(html, seo).replace("<div id=\"root\"></div>", `<div id="root"></div>${content}`));
      };
      await Promise.all([
        writeFile(resolve(out, "sitemap.xml"), sitemapXml(paths)),
        writePage("index.html", homeSeo, fallback),
        writePage("produtos.html", listingSeo(new URLSearchParams()), fallback),
        writePage("checkout.html", privateSeo("/checkout", "Finalização do pedido")),
        writePage("admin.html", privateSeo("/admin", "Área administrativa")),
        writePage("admin/login.html", privateSeo("/admin/login", "Área administrativa")),
        ...products.map((product) => writePage(`produto/${encodeURIComponent(product.slug)}.html`, productSeo(product), `<noscript><main><h1>${escapeXml(product.name)}</h1><p>${escapeXml(product.description ?? "")}</p><a href="/produtos">Ver produtos</a></main></noscript>`)),
      ]);
      console.info(`SEO: sitemap and static product metadata generated (${products.length} active products, ${categories.length} categories).`);
    },
  };
}