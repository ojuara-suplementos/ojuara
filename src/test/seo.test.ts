import { describe, it, expect } from "vitest";
import { absoluteUrl, homeSeo, listingSeo, productSeo, sitemapXml, safeJson, privateSeo, staticHead } from "../lib/seo";
import type { Product } from "../types/catalog";

const product: Product = {
  id: "p1", name: "Creatina & Força", slug: "creatina-forca", description: "Creatina cadastrada na loja.",
  benefits: null, nutrition: null, category_id: "c1", brand_id: null, is_active: true, view_count: 0,
  categories: { id: "c1", name: "Creatina", slug: "creatina", description: "Seleção real de creatinas." },
  product_variants: [
    { id: "v1", product_id: "p1", name: "300g", flavor: "Morango", size: "300g", price: 100, stock: 0, image_url: "https://example.com/morango.webp" },
    { id: "v2", product_id: "p1", name: "150g", flavor: "Abacaxi", size: "150g", price: 79.9, stock: 3, image_url: "https://example.com/abacaxi.webp" },
  ],
};

describe("SEO based on real public records", () => {
  it("uses the confirmed production domain for canonical, sitemap and organization identity", () => {
    expect(absoluteUrl("/")).toBe("https://ojuarasuplementos.com/");
    expect(sitemapXml(["/", "/produtos"])).toContain("<loc>https://ojuarasuplementos.com/produtos</loc>");
    expect(homeSeo.schemas?.[0]?.url).toBe("https://ojuarasuplementos.com/");
  });
  it("uses the confirmed locality without inventing business data", () => {
    const schema = homeSeo.schemas?.[0];
    expect(schema?.address).toEqual({ "@type": "PostalAddress", addressLocality: "Olindina", addressRegion: "BA", addressCountry: "BR" });
    expect(schema).not.toHaveProperty("telephone");
    expect(schema).not.toHaveProperty("openingHours");
  });
  it("uses registered prices, each variant stock and the alphabetical initial image without reviews", () => {
    const seo = productSeo(product);
    const schema = seo.schemas?.find((s) => s["@type"] === "Product");
    expect(schema?.offers).toMatchObject([
      { price: "100.00", priceCurrency: "BRL", availability: "https://schema.org/OutOfStock" },
      { price: "79.90", availability: "https://schema.org/InStock" },
    ]);
    expect(schema?.image).toEqual(["https://example.com/abacaxi.webp"]);
    expect(schema).not.toHaveProperty("aggregateRating");
    expect(seo.path).toBe("/produto/creatina-forca");
  });
  it("makes categories self-canonical, preserves pagination and excludes search facets from indexing", () => {
    const seo = listingSeo(new URLSearchParams("categoria=creatina&page=2&sort=az"), [product.categories as NonNullable<Product["categories"]>]);
    expect(seo.path).toBe("/produtos?categoria=creatina&page=2");
    expect(seo.noindex).toBe(false);
    expect(listingSeo(new URLSearchParams("q=creatina")).noindex).toBe(true);
    expect(listingSeo(new URLSearchParams("marca=1")).noindex).toBe(true);
    expect(listingSeo(new URLSearchParams("categoria=inexistente")).noindex).toBe(true);
  });
  it("excludes private pages and safely encodes XML and JSON without fictional timestamps", () => {
    expect(privateSeo("/checkout", "Checkout").noindex).toBe(true);
    expect(privateSeo("/admin/login", "Login").noindex).toBe(true);
    const xml = sitemapXml(["/", "/produtos?categoria=creatina&page=2", "/"]);
    expect(xml).toContain("categoria=creatina&amp;page=2");
    expect(xml.match(/<url>/g)).toHaveLength(2);
    expect(xml).not.toContain("lastmod");
    expect(safeJson({ value: "</script>" })).not.toContain("</script>");
    expect(JSON.parse(safeJson({ value: "</script>" })).value).toBe("</script>");
  });
  it("emits static product schema using the same canonical and real catalog values", () => {
    const seo = productSeo(product);
    const head = staticHead(seo);
    const schema = head.match(/<script[^>]*>(.*?)<\/script>/s)?.[1];
    expect(JSON.parse(schema ?? "null")).toEqual(seo.schemas);
    expect(head).toContain('href="https://ojuarasuplementos.com/produto/creatina-forca"');
  });
});