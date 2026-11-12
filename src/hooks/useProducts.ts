import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hasStock } from "@/lib/format";
import type { Product, Category, Brand } from "@/types/catalog";

const PRODUCT_SELECT = `
  id, name, slug, description, benefits, nutrition,
  category_id, brand_id, is_active, view_count, type, is_offer,
  categories ( id, name, slug ),
  brands ( id, name ),
  product_variants ( id, product_id, name, flavor, size, price, original_price, image_url, stock )
`;

export function useProducts({ includeOutOfStock = false }: { includeOutOfStock?: boolean } = {}) {
  return useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as unknown as Product[];
      return list;

    },
    // O menu pode consultar kits ativos no mesmo cache, sem mudar o catálogo à venda.
    select: (products) => includeOutOfStock ? products : products.filter(hasStock),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
    // Revalida sempre ao montar (homepage e /produtos) para refletir cadastros/alterações/inativações imediatamente
    refetchOnMount: "always",
  });
}

export function useAllProducts() {
  return useQuery({
    queryKey: ["products", "all"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnMount: (query) => query.state.isInvalidated,
    refetchOnWindowFocus: false,
  });
}

export interface ProductLookup {
  /** Produto disponível para venda (ativo e com estoque). */
  product: Product | null;
  /** true quando o slug existe, mas o produto está inativo ou esgotado. */
  unavailable: boolean;
  /** Nome do produto, mesmo quando indisponível. */
  name: string | null;
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: ["product", slug],
    enabled: !!slug,
    queryFn: async (): Promise<ProductLookup> => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      const found = (data as unknown as Product) ?? null;
      if (!found) return { product: null, unavailable: false, name: null };
      const available = found.is_active !== false && hasStock(found);
      return {
        product: available ? found : null,
        unavailable: !available,
        name: found.name ?? null,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}


export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    queryFn: async (): Promise<Brand[]> => {
      const { data, error } = await supabase.from("brands").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export interface TopViewedProduct {
  id: string;
  name: string;
  view_count: number | null;
}

/** Top 5 produtos mais visualizados (calculado direto no banco). */
export function useTopViewedProducts(limit = 5) {
  return useQuery({
    queryKey: ["products", "top-viewed", limit],
    queryFn: async (): Promise<TopViewedProduct[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, view_count")
        .not("view_count", "is", null)
        .gt("view_count", 0)
        .order("view_count", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as TopViewedProduct[];
    },
    staleTime: 30 * 1000,
    refetchOnMount: "always",
  });
}
