import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, Link, useLocation, useSearchParams } from "react-router-dom";
import { useProduct, useProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { formatPrice, variantDiscount, pickInitialVariant, pixPrice, installmentPrice, INSTALLMENTS, sortSizes, discountLabel, sortedFlavors } from "@/lib/format";
import { useCart } from "@/contexts/CartContext";
import { ProductCarousel } from "@/components/ProductCarousel";
import { Plus, Minus, ShoppingCart, Package, PackageX, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartImage } from "@/components/SmartImage";
import { supabase } from "@/lib/supabase";


const ProductDetail = () => {
  const { slug } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const preferredVariantId =
    searchParams.get("variante") ?? (location.state as { variantId?: string } | null)?.variantId ?? null;
  const { data: lookup, isLoading } = useProduct(slug);
  const product = lookup?.product ?? null;

  const { data: allProducts = [] } = useProducts();
  const { addItem } = useCart();

  const variants = product?.product_variants ?? [];
  const [variantId, setVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState<"desc" | "nutri">("desc");
  const shortDescRef = useRef<HTMLParagraphElement>(null);
  const [showReadMore, setShowReadMore] = useState(false);

  const initialVariant = useMemo(
    () => pickInitialVariant(variants, preferredVariantId),
    [variants, preferredVariantId],
  );

  // Contabiliza 1 visualização por produto por sessão (refresh não incrementa de novo)
  useEffect(() => {
    const id = product?.id;
    if (!id) return;
    const key = `ojuara-viewed-${id}`;
    let hasStorage = true;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      hasStorage = false; // sessionStorage indisponível: segue e contabiliza
    }
    let cancelled = false;
    void (async () => {
      const { error } = await supabase.rpc("increment_product_views", { p_id: id });
      if (cancelled) return;
      if (error) {
        console.error("Falha ao contabilizar visualização do produto:", error.message);
        return;
      }
      // Marca a sessão apenas após o incremento ser confirmado
      if (hasStorage) {
        try {
          sessionStorage.setItem(key, "1");
        } catch {
          /* ignora */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  // Ao trocar de produto/variante da URL, seleciona automaticamente a variante inicial
  useEffect(() => {
    setVariantId(initialVariant?.id ?? null);
    setQuantity(1);
  }, [slug, preferredVariantId, initialVariant?.id]);

  const selected = useMemo(
    () => variants.find((v) => v.id === variantId) ?? initialVariant,
    [variantId, initialVariant, variants],
  );

  const selectedFlavor = selected?.flavor ?? null;

  const stock = Number(selected?.stock) || 0;
  const outOfStock = stock <= 0;
  const atMax = quantity >= stock;

  // 1) Sabores do produto — exibidos em ordem alfabética (A–Z, respeitando acentos)
  const flavors = useMemo(() => sortedFlavors(variants), [variants]);

  // 2) Variações disponíveis apenas para o sabor selecionado
  const sizes = useMemo(
    () =>
      sortSizes(
        Array.from(
          new Set(
            variants
              .filter((v) => (v.flavor ?? null) === selectedFlavor)
              .map((v) => (v.size ?? "").trim())
              .filter(Boolean),
          ),
        ),
      ),
    [variants, selectedFlavor],
  );


  const selectedSize = (selected?.size ?? "").trim() || null;

  const pickFlavor = (flavor: string) => {
    const pool = variants.filter((v) => v.flavor === flavor);
    // seleciona automaticamente a única variação, ou a primeira em estoque
    const match = pool.find((v) => (Number(v.stock) || 0) > 0) ?? pool[0];
    if (match) {
      setVariantId(match.id);
      setQuantity(1);
    }
  };

  const pickSize = (size: string) => {
    const match = variants.find(
      (v) => (v.flavor ?? null) === selectedFlavor && (v.size ?? "").trim() === size,
    );
    if (match) {
      setVariantId(match.id);
      setQuantity(1);
    }
  };

  const scrollToDescription = () => {
    setTab("desc");
    setTimeout(() => {
      const section = document.getElementById("product-description");
      const tabButton = document.querySelector('[data-tab="desc"]') as HTMLElement | null;
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (tabButton) {
        tabButton.focus({ preventScroll: true });
      }
    }, 60);
  };

  useEffect(() => {
    const el = shortDescRef.current;
    if (!el || !product?.description) {
      setShowReadMore(false);
      return;
    }
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const overflowing =
          el.scrollHeight - el.clientHeight > 1 || el.scrollWidth - el.clientWidth > 1;
        setShowReadMore(overflowing);
      });
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener("resize", check);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready?.then(check).catch(() => {});
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [product?.description]);



  const related = useMemo(() => {
    const sameCat = allProducts.filter(
      (p) => p.id !== product?.id && p.category_id === product?.category_id,
    );
    if (sameCat.length >= 4) return sameCat.slice(0, 12);
    const others = allProducts.filter((p) => p.id !== product?.id);
    return [...sameCat, ...others.filter((p) => !sameCat.includes(p))].slice(0, 12);
  }, [allProducts, product]);

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }
  if (!product && lookup?.unavailable) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <PackageX className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" aria-hidden="true" />
        <h1 className="text-xl md:text-2xl font-black mb-2">
          {lookup.name ? `${lookup.name} está indisponível` : "Produto indisponível"}
        </h1>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Este produto está temporariamente fora de estoque. Assim que houver reposição ele volta a aparecer no
          catálogo.
        </p>
        <Button asChild><Link to="/produtos">Ver produtos disponíveis</Link></Button>
      </div>
    );
  }
  if (!product) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Package className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground mb-4">Produto não encontrado.</p>
        <Button asChild><Link to="/produtos">Ver todos os produtos</Link></Button>
      </div>
    );
  }


  const handleAdd = () => {
    if (!selected) return;
    addItem({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      variantId: selected.id,
      variantName: selected.name,
      flavor: selected.flavor,
      size: selectedSize ?? selected.size,
      price: Number(selected.price),
      image: selected.image_url,
      quantity,
      stock: Number(selected.stock) || 0,
    });
  };

  // Imagem da variação selecionada tem prioridade; fallback: imagem do sabor
  const flavorImage = selected
    ? (product.product_variants ?? []).find(
        (v) => (v.flavor ?? "") === (selected.flavor ?? "") && v.image_url,
      )?.image_url
    : undefined;
  const image = selected?.image_url || flavorImage;

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">Início</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/produtos" className="hover:text-primary">Produtos</Link>
          {product.categories && (
            <>
              <ChevronRight className="w-3 h-3" />
              <Link to={`/produtos?categoria=${product.categories.slug}`} className="hover:text-primary">
                {product.categories.name}
              </Link>
            </>
          )}
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] lg:grid-cols-[1.35fr_1fr] xl:grid-cols-[1.3fr_1fr] gap-8 md:gap-8 lg:gap-14 items-stretch">
          {/* Image */}
          <div className="relative w-full aspect-square bg-muted rounded-xl overflow-hidden flex items-center justify-center self-start">
            {variantDiscount(selected) !== null && (
              <span className="absolute top-3 left-3 z-10 bg-primary text-primary-foreground text-xs font-display font-bold px-2 py-1 rounded-sm">
                {discountLabel(variantDiscount(selected)!)}
              </span>
            )}
            <SmartImage
              key={selectedFlavor ?? "default"}
              src={image}
              alt={product.name}
              eager
              width={800}
              height={800}
              fallback={<Package className="w-24 h-24 text-muted-foreground/30" />}
            />

          </div>


          {/* Info */}
          <div className="flex flex-col md:h-full md:justify-between md:py-1 lg:py-2 gap-6 md:gap-2.5 lg:gap-6">
            <div className="flex flex-col gap-3 md:gap-1 lg:gap-2.5">
              {product.brands?.name && (
                <span className="text-xs md:text-[10px] lg:text-xs uppercase tracking-wider text-muted-foreground font-bold">
                  {product.brands.name}
                </span>
              )}
              <h1 className="text-2xl md:text-base lg:text-2xl xl:text-[1.75rem] font-black leading-tight tracking-tight">
                {product.name}
              </h1>
              {product.description && (
                <div className="flex flex-wrap items-baseline gap-1">
                  <p
                    ref={shortDescRef}
                    className="text-sm md:text-xs lg:text-sm text-muted-foreground leading-snug line-clamp-1"
                  >
                    {product.description}
                  </p>
                  {showReadMore && (
                    <button
                      type="button"
                      onClick={scrollToDescription}
                      className="text-sm md:text-xs lg:text-[15px] font-medium text-primary underline"
                    >
                      ler mais +
                    </button>
                  )}
                </div>
              )}
            </div>

            {(() => {
              const discount = variantDiscount(selected);
              const original = Number(selected?.original_price ?? 0);
              return (
                <div key={selected?.id ?? "none"} className="flex flex-col gap-2 md:gap-0.5 lg:gap-1.5 animate-soft-in">
                  {discount !== null && (
                    <div className="flex items-center gap-3 md:gap-2 lg:gap-3">
                      <span className="text-sm md:text-xs lg:text-sm text-muted-foreground line-through">
                        {formatPrice(original)}
                      </span>
                      <span className="bg-primary text-primary-foreground text-xs md:text-[10px] lg:text-xs font-display font-bold px-2 md:px-1.5 py-1 md:py-0.5 lg:px-2 lg:py-1 rounded-sm">
                        {discountLabel(discount)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline gap-2 whitespace-nowrap">
                    <p className="text-2xl md:text-xl lg:text-3xl font-black text-primary leading-none">
                      {formatPrice(pixPrice(Number(selected?.price ?? 0)))}
                    </p>
                    <span className="text-xs md:text-xs lg:text-base font-bold text-primary/80">no Pix</span>
                    <span className="bg-primary/10 text-primary text-[10px] md:text-[10px] lg:text-xs font-display font-bold px-1.5 py-0.5 rounded-sm shrink-0">-5%</span>
                  </div>
                  <p className="text-xs md:text-[11px] lg:text-[13px] text-muted-foreground mt-1">
                    ou {formatPrice(Number(selected?.price ?? 0))} em {INSTALLMENTS}x de {formatPrice(installmentPrice(Number(selected?.price ?? 0)))} sem juros
                  </p>

                </div>
              );
            })()}

            <div className="flex flex-col gap-3 md:gap-2 lg:gap-4">
              {flavors.length > 0 && (
                <VariantSelector
                  label={product.categories?.slug === "acessorios" || product.categories?.name.localeCompare("Acessórios", "pt-BR", { sensitivity: "base" }) === 0 ? "Cor" : "Sabor"}
                  options={flavors}
                  selected={selectedFlavor}
                  onSelect={pickFlavor}
                  soldOut={flavors.filter((f) =>
                    variants
                      .filter((v) => v.flavor === f)
                      .every((v) => (Number(v.stock) || 0) <= 0),
                  )}
                />
              )}

              {sizes.length > 0 && (
                <VariantSelector
                  label="Selecione:"
                  options={sizes}
                  selected={selectedSize}
                  onSelect={pickSize}
                  soldOut={sizes.filter((s) =>
                    variants
                      .filter(
                        (v) => (v.flavor ?? null) === selectedFlavor && (v.size ?? "").trim() === s,
                      )
                      .every((v) => (Number(v.stock) || 0) <= 0),
                  )}
                />
              )}




              {/* Quantity */}
              <div className="flex flex-col gap-2">
                <span className="text-sm md:text-[11px] lg:text-sm font-bold uppercase tracking-wider text-foreground">
                  Quantidade
                </span>
                <div className="inline-flex w-fit items-center border border-border rounded-md">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={outOfStock || quantity <= 1}

                    className="px-3 md:px-2.5 lg:px-3 py-2 md:py-1.5 lg:py-2 hover:bg-muted transition-fast disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Diminuir"
                  >
                    <Minus className="w-4 h-4 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4" />
                  </button>
                  <span className="px-4 md:px-3 lg:px-4 font-bold min-w-[44px] md:min-w-[36px] lg:min-w-[44px] text-center text-sm lg:text-base">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(stock, quantity + 1))}
                    disabled={outOfStock || atMax}
                    className="px-3 md:px-2.5 lg:px-3 py-2 md:py-1.5 lg:py-2 hover:bg-muted transition-fast disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Aumentar"
                  >
                    <Plus className="w-4 h-4 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-auto">
              <Button
                onClick={handleAdd}
                disabled={!selected || outOfStock}
                className="w-full h-11 md:h-9 lg:h-11 gap-2 bg-primary text-primary-foreground font-bold hover:bg-primary/85 transition-fast md:text-xs lg:text-sm"
              >
                <ShoppingCart className="w-4 h-4 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4" />
                {outOfStock ? "Sem estoque" : "Adicionar ao carrinho"}
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div id="product-description" className="mt-12 border-t border-border pt-8">
          <div className="flex gap-1 border-b border-border mb-6">
            <TabButton data-tab="desc" active={tab === "desc"} onClick={() => setTab("desc")}>Descrição</TabButton>
            {product.nutrition && (
              <TabButton data-tab="nutri" active={tab === "nutri"} onClick={() => setTab("nutri")}>
                Informação nutricional
              </TabButton>
            )}
          </div>
          <div className="prose prose-sm max-w-none text-foreground/80 whitespace-pre-line break-words [overflow-wrap:anywhere]">
            {tab === "desc" ? (
              <>
                <p>{product.description || "Sem descrição disponível."}</p>
                {product.benefits && (
                  <>
                    <h3 className="font-bold mt-4 mb-2 text-foreground">Benefícios</h3>
                    <p>{product.benefits}</p>
                  </>
                )}
              </>
            ) : (
              <NutritionContent raw={product.nutrition || ""} productName={product.name} />
            )}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="max-w-6xl mx-auto">
          <ProductCarousel title="Compre também" products={related} />
        </div>
      )}
    </>
  );
};

function VariantSelector({
  label,
  options,
  selected,
  onSelect,
  soldOut = [],
}: {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (val: string) => void;
  soldOut?: string[];
}) {
  return (
    <div className="mb-2 md:mb-0">
      <p className="text-sm md:text-[11px] lg:text-xs font-bold mb-2 md:mb-1 lg:mb-1.5 uppercase tracking-wider text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">

        {options.map((opt) => {
          const isSoldOut = soldOut.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => onSelect(opt)}
              aria-label={isSoldOut ? `${opt} — esgotado` : opt}
              title={isSoldOut ? "Esgotado" : undefined}
              className={cn(
                "px-3.5 py-2 md:px-2 md:py-1 lg:px-3 lg:py-1.5 rounded-md border text-sm md:text-xs lg:text-sm font-medium transition-fast",
                selected === opt
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary",
                isSoldOut && "opacity-50 line-through decoration-1",
              )}
            >
              {opt}
              {isSoldOut && (
                <span className="ml-1.5 text-[10px] no-underline uppercase tracking-wide">
                  esgotado
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}


function TabButton({ active, onClick, children, "data-tab": dataTab }: { active: boolean; onClick: () => void; children: React.ReactNode; "data-tab"?: string }) {
  return (
    <button
      data-tab={dataTab}
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-fast",
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function NutritionContent({ raw, productName }: { raw: string; productName: string }) {
  const trimmed = raw.trim();
  const isImageUrl =
    /^https?:\/\/.+\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(trimmed) ||
    /^https?:\/\/.+\/.+\.(png|jpe?g|webp|gif|svg)/i.test(trimmed);

  if (isImageUrl) {
    return (
      <div className="max-w-xl">
        <img
          src={trimmed}
          alt={`Tabela nutricional - ${productName}`}
          className="w-full h-auto rounded-md border border-border bg-card"
          loading="lazy"
        />
      </div>
    );
  }

  // Fallback: parse "Key: Value" lines into a table
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  const rows = lines
    .map((l) => {
      const idx = l.indexOf(":");
      if (idx === -1) return null;
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
    .filter(Boolean) as [string, string][];

  if (rows.length === 0) {
    return (
      <div className="max-w-xl rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
        {trimmed || "Informação nutricional indisponível para este produto."}
      </div>
    );
  }

  return (
    <table className="w-full max-w-md border border-border rounded-md overflow-hidden">
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={i} className={i % 2 === 0 ? "bg-muted/40" : ""}>
            <td className="px-4 py-2 font-medium border-b border-border">{k}</td>
            <td className="px-4 py-2 text-right border-b border-border">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="h-4 w-48 mb-6 rounded skeleton-shimmer" />
      <div className="grid md:grid-cols-[1.35fr_1fr] xl:grid-cols-[1.5fr_1fr] gap-10 lg:gap-16 items-start">
        <div className="aspect-square rounded-xl skeleton-shimmer" />
        <div className="space-y-4">
          <div className="h-3 w-24 rounded skeleton-shimmer" />
          <div className="h-8 w-3/4 rounded skeleton-shimmer" />
          <div className="h-4 w-full rounded skeleton-shimmer" />
          <div className="h-4 w-5/6 rounded skeleton-shimmer" />
          <div className="h-10 w-40 rounded skeleton-shimmer mt-4" />
          <div className="h-12 w-full rounded skeleton-shimmer mt-6" />
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;
