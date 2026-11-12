import type { ProductVariant } from "@/types/catalog";

export const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

/** Desconto aplicado a pagamentos via Pix (5%). */
export const PIX_DISCOUNT = 0.05;

/** Número de parcelas sem juros oferecidas. */
export const INSTALLMENTS = 5;

/** Valor final com o desconto do Pix aplicado. */
export const pixPrice = (value: number) => (Number(value) || 0) * (1 - PIX_DISCOUNT);

/** Valor de cada parcela sem juros. */
export const installmentPrice = (value: number) => (Number(value) || 0) / INSTALLMENTS;

/** Soma do estoque de todas as variantes de um produto. */
export const totalStock = (variants: { stock?: number | null }[] = []) =>
  variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

/** Produto disponível para venda (alguma variante com estoque). */
export const hasStock = (product: { product_variants?: { stock?: number | null }[] }) =>
  totalStock(product.product_variants ?? []) > 0;

export const minVariantPrice = (variants: { price: number }[]) =>
  variants.length ? Math.min(...variants.map((v) => Number(v.price) || 0)) : 0;


/**
 * Percentual de desconto de uma variante (apenas para exibição).
 * O preço real nunca é alterado: o arredondamento é aplicado somente
 * à porcentagem, sempre como número inteiro (ex.: 23%, nunca 22,5%).
 * O cálculo usa centavos para evitar erros de ponto flutuante.
 */
export const variantDiscount = (
  variant?: Pick<ProductVariant, "price" | "original_price"> | null,
): number | null => {
  if (!variant) return null;
  const priceCents = Math.round((Number(variant.price) || 0) * 100);
  const originalCents = Math.round((Number(variant.original_price) || 0) * 100);
  if (!originalCents || originalCents <= priceCents) return null;
  const pct = Math.round(((originalCents - priceCents) / originalCents) * 100);
  return Math.min(99, Math.max(1, pct));
};

/** Rótulo visual do desconto (aproximado, sem casas decimais). Ex.: "~12% OFF". */
export const discountLabel = (pct: number) => `~${pct}% OFF`;


/**
 * Picks the variant with the cheapest current price.
 */
export const cheapestVariant = <T extends { price: number }>(variants: T[]): T | undefined => {
  if (!variants.length) return undefined;
  return variants.reduce((min, v) => (Number(v.price) < Number(min.price) ? v : min), variants[0]);
};

/**
 * Variants that are actually on sale (original_price greater than price).
 */
export const discountedVariants = <T extends Pick<ProductVariant, "price" | "original_price">>(
  variants: T[],
): T[] => variants.filter((v) => variantDiscount(v) !== null);

/**
 * Variant to feature on a card. In offer contexts only discounted variants are considered.
 */
export const featuredVariant = <T extends Pick<ProductVariant, "price" | "original_price">>(
  variants: T[],
  offerOnly = false,
): T | undefined => {
  const pool = offerOnly ? discountedVariants(variants) : variants;
  return cheapestVariant((pool.length ? pool : variants) as unknown as (T & { price: number })[]);
};

/**
 * Sabores distintos do produto em ordem alfabética (A–Z, respeitando acentos).
 * Regra única compartilhada entre a listagem e a página de detalhes.
 */
export const sortedFlavors = <T extends Pick<ProductVariant, "flavor">>(variants: T[]): string[] =>
  Array.from(new Set(variants.map((v) => v.flavor).filter(Boolean) as string[]))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

/**
 * Variante inicial da página de detalhes: o deep link (?variante=) tem prioridade;
 * sem deep link, começa no primeiro sabor em ordem alfabética (A–Z), preferindo
 * variação com estoque; fallbacks: primeira com estoque, depois a mais barata.
 */
export const pickInitialVariant = <T extends Pick<ProductVariant, "id" | "flavor" | "stock" | "price">>(
  variants: T[],
  preferredVariantId?: string | null,
): T | null => {
  const fallback =
    variants.find((v) => (Number(v.stock) || 0) > 0) ?? cheapestVariant(variants) ?? null;
  if (preferredVariantId) {
    return variants.find((v) => v.id === preferredVariantId) ?? fallback;
  }
  const firstFlavor = sortedFlavors(variants)[0] ?? null;
  if (!firstFlavor) return fallback;
  const pool = variants.filter((v) => (v.flavor ?? "") === firstFlavor);
  return pool.find((v) => (Number(v.stock) || 0) > 0) ?? pool[0] ?? fallback;
};


/**
 * Oferta é 100% automática: o produto tem ao menos uma variante com
 * original_price maior que price.
 */
export const isOfferProduct = (product: {
  product_variants?: Pick<ProductVariant, "price" | "original_price">[];
}): boolean => (product.product_variants ?? []).some((v) => variantDiscount(v) !== null);

/** Um produto é kit se estiver marcado como kit no painel. */
export const isKitProduct = (product: { type?: string | null }): boolean => product.type === "kit";

/**
 * Ordenação inteligente de apresentações/variações (ex.: 400g, 1kg, 30 cápsulas, 250ml, 1L).
 * Converte para uma unidade base por família (massa em g, volume em ml, contagem em unidades).
 * Formatos não reconhecidos caem no fallback alfabético (e vão para o fim).
 */
type SizeFamily = "mass" | "volume" | "count";

const UNIT_MAP: Record<string, { family: SizeFamily; factor: number }> = {
  mcg: { family: "mass", factor: 0.000001 },
  mg: { family: "mass", factor: 0.001 },
  g: { family: "mass", factor: 1 },
  gr: { family: "mass", factor: 1 },
  grama: { family: "mass", factor: 1 },
  gramas: { family: "mass", factor: 1 },
  kg: { family: "mass", factor: 1000 },
  quilo: { family: "mass", factor: 1000 },
  quilos: { family: "mass", factor: 1000 },
  ml: { family: "volume", factor: 1 },
  l: { family: "volume", factor: 1000 },
  lt: { family: "volume", factor: 1000 },
  litro: { family: "volume", factor: 1000 },
  litros: { family: "volume", factor: 1000 },
  cap: { family: "count", factor: 1 },
  caps: { family: "count", factor: 1 },
  capsula: { family: "count", factor: 1 },
  capsulas: { family: "count", factor: 1 },
  comprimido: { family: "count", factor: 1 },
  comprimidos: { family: "count", factor: 1 },
  tablete: { family: "count", factor: 1 },
  tabletes: { family: "count", factor: 1 },
  sache: { family: "count", factor: 1 },
  saches: { family: "count", factor: 1 },
  dose: { family: "count", factor: 1 },
  doses: { family: "count", factor: 1 },
  porcao: { family: "count", factor: 1 },
  porcoes: { family: "count", factor: 1 },
  un: { family: "count", factor: 1 },
  und: { family: "count", factor: 1 },
  unid: { family: "count", factor: 1 },
  unidade: { family: "count", factor: 1 },
  unidades: { family: "count", factor: 1 },
  barra: { family: "count", factor: 1 },
  barras: { family: "count", factor: 1 },
};

const FAMILY_ORDER: Record<SizeFamily, number> = { mass: 0, volume: 1, count: 2 };

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseSize(raw: string): { family: SizeFamily; value: number } | null {
  const s = stripAccents(String(raw ?? "").toLowerCase().trim());
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*([a-z]*)/);
  if (!m) return null;
  const value = Number(m[1].replace(",", "."));
  if (!Number.isFinite(value)) return null;
  let unit = m[2];
  if (!unit) {
    // ex.: "30 capsulas" -> unidade vem depois de espaço já capturada; senão tenta próxima palavra
    const rest = s.slice(m.index! + m[0].length).trim().split(/\s+/)[0] ?? "";
    unit = stripAccents(rest).replace(/[^a-z]/g, "");
  }
  const info = UNIT_MAP[unit];
  if (!info) return value ? { family: "count", value } : null;
  return { family: info.family, value: value * info.factor };
}

export function compareSizes(a: string, b: string): number {
  const pa = parseSize(a);
  const pb = parseSize(b);
  if (pa && pb) {
    if (pa.family !== pb.family) return FAMILY_ORDER[pa.family] - FAMILY_ORDER[pb.family];
    if (pa.value !== pb.value) return pa.value - pb.value;
    return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
  }
  if (pa) return -1;
  if (pb) return 1;
  return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
}

export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort(compareSizes);
}
