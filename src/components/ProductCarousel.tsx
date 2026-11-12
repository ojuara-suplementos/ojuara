import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/types/catalog";
import { ProductCard } from "./ProductCard";

interface Props {
  title: ReactNode;
  subtitle?: string;
  products: Product[];
  offerOnly?: boolean;
}

export function ProductCarousel({ title, subtitle, products, offerOnly = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setOverflow(el.scrollWidth > el.clientWidth + 4);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [products.length]);

  const scroll = (dir: number) => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  if (products.length === 0) return null;

  return (
    <section className="container mx-auto px-4">
      <div className="flex items-end justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h2 className="pt-10 md:pt-14 font-display text-2xl md:text-4xl font-bold">{title}</h2>
          {subtitle && (
            <p className="text-muted-foreground text-[11px] md:text-sm mt-1 uppercase tracking-wider font-medium leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {overflow && (
          <div className="hidden md:flex gap-2">
            <button
              onClick={() => scroll(-1)}
              className="p-2.5 rounded-sm border border-border bg-secondary hover:bg-primary hover:text-primary-foreground hover:border-primary transition-fast"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll(1)}
              className="p-2.5 rounded-sm border border-border bg-secondary hover:bg-primary hover:text-primary-foreground hover:border-primary transition-fast"
              aria-label="Próximo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <div
        ref={ref}
        className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 pr-4"
      >
        {products.map((p) => (
          <div key={p.id} className="snap-start flex-shrink-0 w-[160px] sm:w-[220px] md:w-[260px] md:pb-6-">
            <ProductCard product={p} offerOnly={offerOnly} />
          </div>
        ))}
      </div>
    </section>
  );
}
