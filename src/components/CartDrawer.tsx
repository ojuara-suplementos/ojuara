import { useNavigate, Link } from "react-router-dom";
import { X, Plus, Minus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { cartKey } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/SmartImage";
import { formatPrice, pixPrice, installmentPrice, INSTALLMENTS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export function CartDrawer() {
  const { isOpen, closeCart, items, updateQuantity, removeItem, total, lastAddedKey } = useCart();
  const navigate = useNavigate();

  // Bloqueia o scroll da página mantendo a posição, liberando apenas o drawer
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const { body } = document;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo({ top: scrollY, behavior: "auto" });
    };
  }, [isOpen]);

  useEscapeKey(isOpen, closeCart);

  if (!isOpen) return null;


  const goCheckout = () => {
    closeCart();
    navigate("/checkout");
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={closeCart} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-label="Carrinho de compras" className="absolute right-0 top-0 h-full w-full max-w-md bg-background shadow-2xl animate-slide-in-right flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary text-secondary-foreground">
          <span className="font-bold text-lg flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            Seu carrinho
          </span>
          <button onClick={closeCart} aria-label="Fechar carrinho" className="p-1 hover:text-primary">
            <X className="w-6 h-6" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <ShoppingBag className="w-16 h-16 text-muted-foreground/30" />
            <p className="text-muted-foreground">Seu carrinho está vazio</p>
            <Button onClick={closeCart} variant="outline">Continuar comprando</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.map((item) => {
                const key = cartKey(item.variantId, item.size);
                return (
                <div
                  key={key}
                  className={cn(
                    "relative flex gap-3 p-3 rounded-lg border border-border items-stretch transition-colors duration-300",
                    lastAddedKey === key && "animate-highlight border-primary/60",
                  )}
                >
                  {item.productSlug ? (
                    <Link
                      to={`/produto/${item.productSlug}?variante=${item.variantId}`}
                      className="w-20 h-20 bg-muted rounded-md overflow-hidden flex-shrink-0 block"
                      onClick={closeCart}
                    >
                      <SmartImage
                        src={item.image}
                        alt={item.productName}
                        width={80}
                        height={80}
                        fallback={
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                            <ShoppingBag className="w-6 h-6" />
                          </div>
                        }
                      />
                    </Link>
                  ) : (
                    <div className="w-20 h-20 bg-muted rounded-md overflow-hidden flex-shrink-0">
                      <SmartImage
                        src={item.image}
                        alt={item.productName}
                        width={80}
                        height={80}
                        fallback={
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                            <ShoppingBag className="w-6 h-6" />
                          </div>
                        }
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col w-full">
                    {item.productSlug ? (
                      <Link
                        to={`/produto/${item.productSlug}?variante=${item.variantId}`}
                        className="block"
                        onClick={closeCart}
                      >
                        <h4 className="font-semibold text-sm w-full pr-10 overflow-hidden text-ellipsis whitespace-nowrap">
                          {item.productName}
                        </h4>
                      </Link>
                    ) : (
                      <h4 className="font-semibold text-sm w-full pr-10 overflow-hidden text-ellipsis whitespace-nowrap">
                        {item.productName}
                      </h4>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[item.flavor, item.size].filter(Boolean).join(" · ") || item.variantName}
                    </p>
                    <div className="flex items-center mt-auto pt-2">
                      <div className="flex items-center border border-border rounded-md">
                        <button
                          onClick={() => updateQuantity(key, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="p-1.5 hover:bg-muted transition-fast disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Diminuir"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-sm font-medium min-w-[24px] text-center">{item.quantity}</span>

                        <button
                          onClick={() => updateQuantity(key, item.quantity + 1)}
                          disabled={item.quantity >= (Number(item.stock) || 0)}
                          className="p-1.5 hover:bg-muted transition-fast disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Aumentar"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-3 right-3 flex flex-col items-end leading-tight">
                    <span className="text-xs text-muted-foreground">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                    <span className="text-sm">
                      ou <span className="font-bold text-primary">{formatPrice(pixPrice(item.price * item.quantity))}</span> <span className="text-[10px] font-bold text-primary/80">no Pix</span>
                    </span>
                  </div>
                  <button
                    onClick={() => removeItem(key)}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-fast flex items-center justify-center w-10 h-10"
                    aria-label="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                );
              })}
            </div>

            <div className="border-t border-border p-4 space-y-3 bg-muted/30">
              <div className="flex items-start justify-between gap-3">
                <span className="font-bold text-lg pt-1">Total</span>
                <div className="flex flex-col items-end leading-tight">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-primary">{formatPrice(pixPrice(total))}</span>
                    <span className="text-xs font-bold text-primary/80">no Pix</span>
                  </div>
                  <span className="text-xs text-muted-foreground mt-0.5">
                    ou {formatPrice(total)} em <span className="font-bold text-foreground">{INSTALLMENTS}x de {formatPrice(installmentPrice(total))}</span> sem juros
                  </span>

                </div>
              </div>
              <Button
                onClick={goCheckout}
                className="w-full h-12 text-base font-bold gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
              >
                Finalizar pedido
              </Button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
