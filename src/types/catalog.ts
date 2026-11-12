export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}


export interface Brand {
  id: string;
  name: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  flavor: string | null;
  size: string | null;
  price: number;
  original_price?: number | null;
  image_url: string | null;
  stock: number;
}

export type ProductType = "normal" | "offer" | "kit";

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  benefits: string | null;
  nutrition: string | null;
  category_id: string | null;
  brand_id: string | null;
  is_active: boolean;
  view_count: number | null;
  type?: ProductType | null;
  is_offer?: boolean | null;
  categories?: Category | null;
  brands?: Brand | null;
  product_variants: ProductVariant[];
}

export interface CartItem {
  productId: string;
  productSlug: string;
  productName: string;
  variantId: string;
  variantName: string;
  flavor: string | null;
  size: string | null;
  price: number;
  image: string | null;
  quantity: number;
  stock: number;
}
