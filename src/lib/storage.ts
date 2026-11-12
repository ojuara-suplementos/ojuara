import { supabase } from "@/lib/supabase";

export const STORAGE_BUCKET = "products";

const PUBLIC_MARKER = `/storage/v1/object/public/${STORAGE_BUCKET}/`;

/**
 * Extrai o caminho interno do bucket a partir de uma URL pública.
 * Retorna null para URLs externas ou inválidas.
 */
export function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const index = url.indexOf(PUBLIC_MARKER);
  if (index === -1) return null;
  const path = url.slice(index + PUBLIC_MARKER.length).split("?")[0];
  const decoded = decodeURIComponent(path);
  return decoded.trim() ? decoded : null;
}

/**
 * Remove arquivos do bucket da aplicação. Ignora URLs externas e nunca
 * interrompe a operação principal — falhas apenas são logadas.
 */
export async function removeStorageImages(urls: (string | null | undefined)[]): Promise<void> {
  const paths = Array.from(
    new Set(urls.map(storagePathFromUrl).filter((p): p is string => !!p)),
  );
  if (paths.length === 0) return;
  try {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
    if (error) console.warn("Falha ao remover imagens do storage:", error.message);
  } catch (err) {
    console.warn("Falha ao remover imagens do storage:", err);
  }
}

export function removeStorageImage(url: string | null | undefined): Promise<void> {
  return removeStorageImages([url]);
}

/**
 * Remove uploads feitos durante uma sessão de edição que não foram salvos.
 * Antes de apagar, confere no banco se a URL não está vinculada a nenhum
 * produto/variação — evitando excluir imagens reutilizadas.
 */
export async function removeUnusedUploads(urls: (string | null | undefined)[]): Promise<void> {
  const candidates = Array.from(
    new Set(urls.filter((u): u is string => !!u && !!storagePathFromUrl(u))),
  );
  if (candidates.length === 0) return;

  const inUse = new Set<string>();
  try {
    const [variants, products] = await Promise.all([
      supabase.from("product_variants").select("image_url").in("image_url", candidates),
      supabase.from("products").select("nutrition").in("nutrition", candidates),
    ]);
    (variants.data ?? []).forEach((v) => v.image_url && inUse.add(v.image_url));
    (products.data ?? []).forEach((p) => p.nutrition && inUse.add(p.nutrition));
    if (variants.error || products.error) return; // em dúvida, não apaga nada
  } catch (err) {
    console.warn("Falha ao verificar uso das imagens:", err);
    return;
  }

  await removeStorageImages(candidates.filter((u) => !inUse.has(u)));
}
