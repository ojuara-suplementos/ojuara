import { supabase } from "@/lib/supabase";

interface StockLike {
  stock?: number | null;
}

export function hasStock(variants: StockLike[]): boolean {
  return variants.some((v) => (Number(v.stock) || 0) > 0);
}

/**
 * Fonte única de verdade para a auto-inativação de produtos.
 * Recalcula se o produto possui alguma variação com estoque > 0:
 * - possui  -> mantém o produto como está (não reativa manualmente);
 * - não possui -> inativa automaticamente.
 *
 * Retorna true quando o produto foi inativado por esta rotina.
 */
export async function syncProductActive(
  productId: string,
  variants: StockLike[],
  currentIsActive: boolean,
): Promise<boolean> {
  const inStock = hasStock(variants);
  if (inStock || !currentIsActive) return false;

  const { error } = await supabase
    .from("products")
    .update({ is_active: false })
    .eq("id", productId);
  if (error) {
    console.warn("Falha ao inativar produto sem estoque:", error.message);
    return false;
  }
  return true;
}

export const OUT_OF_STOCK_TOAST = {
  title: "Produto inativado automaticamente",
  description: "Nenhuma variação possui estoque disponível.",
};
