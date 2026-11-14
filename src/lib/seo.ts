import type { Category, Product, ProductVariant } from "../types/catalog";
import { SITE_NAME } from "../config/site";
import { pickInitialVariant } from "./format";

export const SITE_URL = "https://ojuarasuplementos.com";
export const HOME_TITLE = "Ojuara Suplementos | Suplementos em Olindina, Bahia";
export const HOME_DESCRIPTION = "Encontre suplementos, creatina, proteínas e acessórios na Ojuara Suplementos, em Olindina, Bahia. Consulte produtos, sabores, preços e disponibilidade.";

export interface SeoData {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  type?: "website" | "product";
  schemas?: Record<string, unknown>[];
}

export const absoluteUrl = (path: string) => new URL(path, `${SITE_URL}/`).href;
export const productPath = (slug: string) => `/produto/${encodeURIComponent(slug)}`;
export const categoryPath = (slug: string) => `/produtos?categoria=${encodeURIComponent(slug)}`;
export const plainDescription = (text: string | null | undefined, fallback: string) => {
  const clean = (text || fallback).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return clean.length <= 160 ? clean : `${clean.slice(0, 157).trimEnd()}…`;
};

export const storeSchemas: Record<string, unknown>[] = [
  {
    "@context": "https://schema.org", "@type": "Organization", "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME, url: `${SITE_URL}/`,
    address: { "@type": "PostalAddress", addressLocality: "Olindina", addressRegion: "BA", addressCountry: "BR" },
  },
  { "@context": "https://schema.org", "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: SITE_NAME, url: `${SITE_URL}/`, inLanguage: "pt-BR", publisher: { "@id": `${SITE_URL}/#organization` } },
];

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(item.path) })),
  };
}

export const homeSeo: SeoData = { title: HOME_TITLE, description: HOME_DESCRIPTION, path: "/", schemas: storeSchemas };

export function listingSeo(params: URLSearchParams, categories: Category[] = []): SeoData {
  const categorySlug = params.get("categoria");
  const category = categories.find((item) => item.slug === categorySlug);
  const type = params.get("tipo");
  const typeLabel = type === "offer" || type === "oferta" ? "Ofertas" : type === "kit" ? "Kits" : null;
  const query = params.get("q");
  const label = query ? `Busca por ${query}` : category?.name ?? typeLabel ?? "Produtos";
  const canonical = new URLSearchParams();
  if (category) canonical.set("categoria", category.slug);
  if (typeLabel) canonical.set("tipo", typeLabel === "Ofertas" ? "offer" : "kit");
  const page = Number(params.get("page"));
  if (Number.isInteger(page) && page > 1) canonical.set("page", String(page));
  const suffix = Number.isInteger(page) && page > 1 ? ` — Página ${page}` : "";
  const canonicalQuery = canonical.toString();
  const path = `/produtos${canonicalQuery ? `?${canonicalQuery}` : ""}`;
  const invalidCategory = Boolean(categorySlug && !category);
  const faceted = ["q", "marca", "sabor", "preco"].some((key) => params.has(key));
  return {
    title: `${label}${suffix} | Ojuara Suplementos`,
    description: plainDescription(category?.description, `${label} na Ojuara Suplementos. Consulte os produtos do catálogo, suas variações, preços e disponibilidade.${suffix}`),
    path, noindex: faceted || invalidCategory || Boolean(type && !typeLabel),
    schemas: [breadcrumbs([{ name: "Início", path: "/" }, { name: "Produtos", path: "/produtos" }, ...(category || typeLabel ? [{ name: label, path }] : [])])],
  };
}

function publicImage(image: string | null | undefined): string | undefined {
  if (!image) return undefined;
  try { const url = new URL(image); return url.protocol === "https:" ? url.href : undefined; } catch { return undefined; }
}

export function productImageAlt(product: Product, variant?: ProductVariant | null) {
  return [product.name, product.brands?.name, variant?.flavor, variant?.size].filter(Boolean).join(" — ");
}

export function productSeo(product: Product): SeoData {
  const path = productPath(product.slug);
  const initial = pickInitialVariant(product.product_variants);
  const initialImage = publicImage(initial?.image_url || product.product_variants.find((v) => v.flavor === initial?.flavor && v.image_url)?.image_url);
  const description = plainDescription(product.description, `${product.name}${product.brands?.name ? ` da ${product.brands.name}` : ""} na Ojuara Suplementos. Consulte sabores, apresentações, preços e disponibilidade.`);
  const offers = product.product_variants.filter((variant) => Number.isFinite(Number(variant.price)) && Number(variant.price) > 0).map((variant) => ({
    "@type": "Offer", url: absoluteUrl(`${path}?variante=${encodeURIComponent(variant.id)}`),
    priceCurrency: "BRL", price: Number(variant.price).toFixed(2),
    availability: Number(variant.stock) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    seller: { "@id": `${SITE_URL}/#organization` },
  }));
  return {
    title: `${product.name}${product.brands?.name ? ` | ${product.brands.name}` : ""} | Ojuara Suplementos`, description, path, type: "product",
    schemas: [
      ...storeSchemas,
      breadcrumbs([{ name: "Início", path: "/" }, { name: "Produtos", path: "/produtos" }, ...(product.categories ? [{ name: product.categories.name, path: categoryPath(product.categories.slug) }] : []), { name: product.name, path }]),
      { "@context": "https://schema.org", "@type": "Product", "@id": `${absoluteUrl(path)}#product`, name: product.name, description,
        ...(initialImage ? { image: [initialImage] } : {}),
        ...(product.brands?.name ? { brand: { "@type": "Brand", name: product.brands.name } } : {}),
        ...(product.categories?.name ? { category: product.categories.name } : {}), ...(offers.length ? { offers } : {}),
      },
    ],
  };
}

export const privateSeo = (path: string, label: string): SeoData => ({ title: `${label} | Ojuara Suplementos`, description: "Página não destinada aos resultados de busca.", path, noindex: true });
export const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
export const escapeXml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char] ?? char));
export function sitemapXml(paths: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...new Set(paths)].map((path) => `  <url><loc>${escapeXml(absoluteUrl(path))}</loc></url>`).join("\n")}\n</urlset>\n`;
}

/** Shared metadata serializer for the static HTML delivered to non-JS crawlers. */
export function staticHead(seo: SeoData) {
  const title = escapeXml(seo.title), description = escapeXml(seo.description), url = escapeXml(absoluteUrl(seo.path));
  const head = `<title>${title}</title>\n<meta name="description" content="${description}" />\n<link rel="canonical" href="${url}" />\n<meta name="robots" content="${seo.noindex ? "noindex, follow" : "index, follow"}" />\n<meta property="og:title" content="${title}" />\n<meta property="og:description" content="${description}" />\n<meta property="og:type" content="${seo.type ?? "website"}" />\n<meta property="og:url" content="${url}" />\n<meta property="og:site_name" content="${escapeXml(SITE_NAME)}" />\n<meta property="og:locale" content="pt_BR" />\n<meta name="twitter:card" content="summary" />\n<meta name="twitter:title" content="${title}" />\n<meta name="twitter:description" content="${description}" />\n<script type="application/ld+json">${safeJson(seo.schemas ?? [])}</script>`;
  return head.replace(/<(meta|link|script) /g, '<$1 data-rh="true" ');
}