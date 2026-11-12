import type { Category, Product } from "@/types/catalog";

/** Normalização única: sem acentos, minúsculo, sem hífen/pontuação, espaços simples. */
export const normalizeText = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const tokenize = (value: string | null | undefined) => normalizeText(value).split(" ").filter(Boolean);

/** Plural simples do português: remove "s"/"es" final de palavras com 4+ letras. */
const singularize = (word: string) => {
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
};

/**
 * Busca de produtos: apenas o nome do produto.
 * Nunca considera sabor, variação, marca, descrição, benefícios ou categoria.
 */
export const productMatchesQuery = (product: Product, query: string) => {
  const terms = tokenize(query);
  if (!terms.length) return true;

  const haystack = normalizeText(product.name);

  return terms.every((term) => haystack.includes(term));
};

/**
 * Reconhecimento de categoria: só quando o termo buscado corresponde
 * explicitamente ao nome da categoria (palavra inteira, tolerando
 * acentos, hífen, caixa e plural). Retorna null se ambíguo ou sem match.
 */
export const matchCategoryByQuery = (query: string, categories: Category[]): Category | null => {
  const terms = tokenize(query).map(singularize);
  if (!terms.length) return null;

  const matches = categories.filter((c) => {
    const catWords = [...tokenize(c.name), ...tokenize(c.slug)].map(singularize);
    if (!catWords.length) return false;
    return terms.every((t) => catWords.includes(t));
  });

  return matches.length === 1 ? matches[0] : null;
};
