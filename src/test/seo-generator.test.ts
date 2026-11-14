import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("vite", () => ({ loadEnv: () => ({}) }));
import { fetchPublicRows, replaceSeoHead } from "../../scripts/seo-plugin";
import { productSeo } from "../lib/seo";

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => vi.stubGlobal("AbortSignal", { timeout: () => undefined }));

it("reads only active public products and paginates beyond the first API page", async () => {
  const urls: URL[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: URL) => {
    urls.push(input);
    return { ok: true, json: async () => urls.length === 1 ? Array.from({ length: 500 }, (_, id) => ({ id })) : [{ id: 500 }] };
  }));
  const rows = await fetchPublicRows("products", "id,name,slug", { url: "https://example.com", key: "public-test-key" });
  expect(rows).toHaveLength(501);
  expect(urls.every((url) => url.searchParams.get("is_active") === "eq.true")).toBe(true);
  expect(urls[1].searchParams.get("offset")).toBe("500");
});

it("refuses to silently generate incomplete SEO when the catalog fails", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403 })));
  await expect(fetchPublicRows("products", "id", { url: "https://example.com", key: "public-test-key" })).rejects.toThrow("403");
});

it("replaces minified head metadata without comments and keeps application scripts", () => {
  const seo = productSeo({ id: "p", name: "Creatina", slug: "creatina", description: "Descrição real", benefits: null, nutrition: null, category_id: null, brand_id: null, is_active: true, view_count: 0, product_variants: [] });
  const html = replaceSeoHead('<html><head><title>Old</title><meta name="description" content="Old"/><meta property="og:title" content="Old"/><script type="module" src="/assets/main.js"></script></head><body><div id="root"></div></body></html>', seo);
  expect(html.match(/<title>/g)).toHaveLength(1);
  expect(html.match(/name="description"/g)).toHaveLength(1);
  expect(html).toContain('href="https://ojuarasuplementos.com/produto/creatina"');
  expect(html).toContain('src="/assets/main.js"');
  expect(html).not.toContain("Old");
});