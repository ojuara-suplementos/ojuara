/**
 * Normalizações usadas no cadastro de produtos do painel administrativo.
 */

const LOWER_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "em"]);

const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Capitaliza cada palavra, mantendo conectivos em minúsculo (exceto a primeira). */
export const capitalizeWords = (value: string) =>
  value
    .toLowerCase()
    .split(" ")
    .map((word, i) => {
      if (!word) return word;
      if (i > 0 && LOWER_WORDS.has(stripAccents(word))) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");

/** Nome do produto: capitaliza durante a digitação, preservando um espaço final. */
export const normalizeProductName = (value: string) => {
  const trailing = /\s$/.test(value) ? " " : "";
  return capitalizeWords(value.replace(/\s+/g, " ").trimStart()) + trailing;
};

/** Sabor: apenas letras, espaços, vírgulas e acentos. Capitaliza automaticamente. */
export const normalizeFlavor = (value: string) => {
  const cleaned = value.replace(/[^\p{L}\p{N}\s,]/gu, "").replace(/\s{2,}/g, " ").trimStart();
  const trailing = /\s$/.test(cleaned) ? " " : "";
  return capitalizeWords(cleaned.trimEnd()) + trailing;
};

const SHORT_UNITS: Record<string, string> = {
  g: "g",
  gr: "g",
  grama: "g",
  gramas: "g",
  kg: "kg",
  quilo: "kg",
  quilos: "kg",
  mg: "mg",
  ml: "ml",
  l: "l",
  lt: "l",
  litro: "l",
  litros: "l",
};

const WORD_UNITS: Record<string, string> = {
  capsula: "cápsula",
  capsulas: "cápsulas",
  caps: "cápsulas",
  sache: "sachê",
  saches: "sachês",
  comprimido: "comprimido",
  comprimidos: "comprimidos",
  tablete: "tablete",
  tabletes: "tabletes",
  unidade: "unidade",
  unidades: "unidades",
  porcao: "porção",
  porcoes: "porções",
  doses: "doses",
  dose: "dose",
  goma: "goma",
  gomas: "gomas",
  barra: "barra",
  barras: "barras",
};

/**
 * Variação: "500 G" → "500g", "30 CAPSULAS" → "30 cápsulas", "1 KG" → "1kg".
 */
export const normalizeSize = (value: string) => {
  const raw = value.trim().replace(/\s+/g, " ");
  if (!raw) return "";
  const match = raw.match(/^([\d]+(?:[.,]\d+)?)\s*(.*)$/);
  if (!match) return capitalizeWords(raw.toLowerCase());
  const [, num, rest] = match;
  const unitRaw = rest.trim().toLowerCase();
  if (!unitRaw) return num;
  const key = stripAccents(unitRaw);
  if (SHORT_UNITS[key]) return `${num}${SHORT_UNITS[key]}`;
  if (WORD_UNITS[key]) return `${num} ${WORD_UNITS[key]}`;
  return `${num} ${unitRaw}`;
};

/** Formata número para moeda brasileira sem o símbolo. */
export const formatCurrencyInput = (value: number | null | undefined) =>
  value == null || Number.isNaN(value)
    ? ""
    : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        value,
      );

/** Converte dígitos digitados em valor monetário (centavos). */
export const parseCurrencyDigits = (value: string): number | undefined => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return undefined;
  return Number(digits) / 100;
};
