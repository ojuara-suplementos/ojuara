import { supabase } from "@/lib/supabase";
import { removeStorageImages } from "@/lib/storage";

/**
 * Exclusão definitiva de um produto.
 *
 * Sequência:
 * 1. localiza TODAS as imagens do produto (direto no banco, nunca do cache);
 * 2. exclui as variações e o produto do banco;
 * 3. somente após o sucesso no banco, remove os arquivos do Storage
 *    (falhas apenas são logadas e nunca bloqueiam a operação).
 *
 * Categorias e marcas nunca são afetadas.
 */
export async function deleteProductCompletely(productId: string): Promise<void> {
  // 1. imagens atuais (fonte da verdade: banco)
  const images: (string | null)[] = [];

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("nutrition")
    .eq("id", productId)
    .maybeSingle();
  if (productError) console.warn("Falha ao ler produto para limpeza:", productError.message);
  if (product?.nutrition) images.push(product.nutrition as string);

  const { data: variants, error: variantsError } = await supabase
    .from("product_variants")
    .select("image_url")
    .eq("product_id", productId);
  if (variantsError) console.warn("Falha ao ler variações para limpeza:", variantsError.message);
  for (const v of variants ?? []) images.push((v as { image_url: string | null }).image_url);

  // 2. Banco — remove variações explicitamente (não depende de cascade)
  const { error: delVariants } = await supabase
    .from("product_variants")
    .delete()
    .eq("product_id", productId);
  if (delVariants) throw delVariants;

  const { error: delProduct } = await supabase.from("products").delete().eq("id", productId);
  if (delProduct) throw delProduct;

  // 3. Storage (somente após o banco confirmar; ignora URLs externas)
  await removeStorageImages(images);
}

