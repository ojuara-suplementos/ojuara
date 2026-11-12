import { memo } from "react";
import { Link } from "react-router-dom";
import type { Product } from "@/types/catalog";
import { formatPrice, featuredVariant, variantDiscount, pixPrice, installmentPrice, INSTALLMENTS, discountLabel, sortedFlavors } from "@/lib/format";
import { SmartImage } from "@/components/SmartImage";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  product: Product;
  /** Em contextos de oferta, destaca apenas variantes com desconto */
  offerOnly?: boolean;
}

export const ProductCard = memo(function ProductCard({ product, offerOnly = false }: Props) {
  const variants = product.product_variants ?? [];
  const featured = featuredVariant(variants, offerOnly);
  const price = Number(featured?.price ?? 0);
  const originalPrice = Number(featured?.original_price ?? 0);
  const discount = variantDiscount(featured);
  // Imagem principal: da primeira variação com imagem do primeiro sabor em ordem alfabética (A–Z)
  const firstFlavor = sortedFlavors(variants)[0] ?? null;
  const flavorPool = firstFlavor ? variants.filter((v) => (v.flavor ?? "") === firstFlavor) : [];
  const imageVariant =
    flavorPool.find((v) => v.image_url && (Number(v.stock) || 0) > 0) ??
    flavorPool.find((v) => v.image_url);
  const image = imageVariant?.image_url ?? featured?.image_url;
  const soldOut = !featured || (Number(featured?.stock) || 0) <= 0;
  // Link abre a variação cuja imagem é exibida no card (em ofertas, a variante em destaque)
  const linkVariant = offerOnly ? featured : (imageVariant ?? featured);


  return (
    <Link
      to={`/produto/${product.slug}${linkVariant ? `?variante=${linkVariant.id}` : ""}`}
      className="group relative flex flex-col h-full bg-card rounded-sm overflow-hidden border border-border hover:border-primary/60 card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* Discount badge */}
      {discount !== null && (
        <span className="absolute top-3 left-3 z-10 bg-primary text-primary-foreground text-xs font-display font-bold tracking-wider px-2.5 py-1 rounded-sm shadow-md">
          {discountLabel(discount)}
        </span>
      )}

      <div className="relative aspect-square bg-muted overflow-hidden flex items-center justify-center">
        <SmartImage
          src={image}
          alt={product.name}
          width={400}
          height={400}
          className="transition-opacity duration-200 ease-out group-hover:opacity-90"
          fallback={<Package className="w-16 h-16 text-muted-foreground/30" />}
        />
      </div>


      <div className="p-3 sm:p-4 flex flex-col flex-1 gap-1">
        <h3 className="font-display font-bold text-sm sm:text-base uppercase tracking-wide line-clamp-2 leading-snug min-h-[2.45rem]">
          {product.name}
        </h3>
        <div className="w-full min-w-0 min-h-[2rem]">
          <p className="max-h-[2rem] overflow-hidden text-xs text-muted-foreground line-clamp-2 break-words leading-4">
            {product.description ?? ""}
          </p>
        </div>


        <div className="mt-auto pt-3 flex flex-col leading-none">
          {discount !== null && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(originalPrice)}
              </span>
              <span className="bg-primary text-primary-foreground text-[10px] font-display font-bold px-1.5 py-0.5 rounded-sm">
                {discountLabel(discount)}
              </span>
            </div>
          )}
          <div className="flex items-baseline gap-1 mt-1 whitespace-nowrap">
            <p className="text-base sm:text-xl font-display font-bold text-primary leading-none">
              {formatPrice(pixPrice(price))}
            </p>
            <span className="text-[10px] sm:text-[11px] font-bold text-primary/80">no Pix</span>
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-1 py-0.5 rounded-sm shrink-0">-5%</span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 leading-snug">
            ou {formatPrice(price)} em {INSTALLMENTS}x de {formatPrice(installmentPrice(price))} sem juros
          </span>
        </div>
        <span
          aria-hidden="true"
          className={cn(
            "w-full mt-3 h-9 inline-flex items-center justify-center rounded-sm border border-transparent bg-primary text-primary-foreground font-display font-bold uppercase text-xs tracking-wider transition-colors",
            soldOut ? "opacity-50" : "group-hover:bg-marquee",
          )}
        >
          {soldOut ? "Esgotado" : "Comprar"}
        </span>

      </div>
    </Link>
  );
});
