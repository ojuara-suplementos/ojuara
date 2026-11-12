import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { CartItem } from "@/types/catalog";
import { toast } from "@/hooks/use-toast";

export const cartKey = (variantId: string, size: string | null | undefined) =>
  `${variantId}::${size ?? ""}`;

export interface VariantAvailability {
  stock: number;
  price: number;
}

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: CartItem) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, qty: number) => void;
  /**
   * Sincroniza o carrinho com a disponibilidade real das variantes.
   * Remove itens inexistentes/esgotados, ajusta quantidades acima do estoque
   * e atualiza preço/estoque. Retorna um resumo das mudanças aplicadas.
   */
  syncAvailability: (map: Record<string, VariantAvailability | null>) => {
    removed: string[];
    adjusted: string[];
    priceChanged: string[];
  };
  clear: () => void;
  total: number;
  count: number;
  /** Chave do último item adicionado — usado para destaque visual no carrinho */
  lastAddedKey: string | null;
}


const CartContext = createContext<CartContextValue | undefined>(undefined);
const STORAGE_KEY = "powerfit-cart";


export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [isOpen, setIsOpen] = useState(false);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Limpa o destaque do item recém-adicionado após ~1s
  useEffect(() => {
    if (!lastAddedKey) return;
    const timer = window.setTimeout(() => setLastAddedKey(null), 1200);
    return () => window.clearTimeout(timer);
  }, [lastAddedKey]);

  const addItem = (item: CartItem) => {
    const maxStock = Math.max(0, Number(item.stock) || 0);
    if (maxStock <= 0) {
      toast({ title: "Sem estoque", description: "Este produto está esgotado.", variant: "destructive" });
      return;
    }
    const key = cartKey(item.variantId, item.size);
    let clamped = false;
    let changed = false;
    setItems((prev) => {
      const existing = prev.find((i) => cartKey(i.variantId, i.size) === key);
      if (existing) {
        const desired = existing.quantity + item.quantity;
        const next = Math.min(desired, maxStock);
        if (next === existing.quantity) {
          clamped = true;
          return prev;
        }
        if (next < desired) clamped = true;
        changed = true;
        return prev.map((i) =>
          cartKey(i.variantId, i.size) === key ? { ...i, quantity: next, stock: maxStock } : i,
        );
      }
      const qty = Math.min(item.quantity, maxStock);
      if (qty < item.quantity) clamped = true;
      changed = true;
      return [...prev, { ...item, quantity: qty, stock: maxStock }];
    });

    if (clamped) {
      toast({
        title: "Estoque limitado",
        description: `Apenas ${maxStock} unidade(s) disponível(is).`,
      });
    }

    if (changed) setLastAddedKey(key);
    setIsOpen(true);
  };

  const removeItem = (key: string) =>
    setItems((prev) => prev.filter((i) => cartKey(i.variantId, i.size) !== key));

  const updateQuantity = (key: string, qty: number) => {
    if (qty <= 0) return removeItem(key);
    setItems((prev) =>
      prev.map((i) => {
        if (cartKey(i.variantId, i.size) !== key) return i;
        const max = Math.max(0, Number(i.stock) || 0);
        const next = Math.min(qty, max);
        if (next < qty) {
          toast({
            title: "Estoque limitado",
            description: `Apenas ${max} unidade(s) disponível(is).`,
          });
        }
        return { ...i, quantity: next };
      }),
    );
  };

  const syncAvailability = (map: Record<string, VariantAvailability | null>) => {
    const removed: string[] = [];
    const adjusted: string[] = [];
    const priceChanged: string[] = [];

    setItems((prev) =>
      prev.flatMap((i) => {
        if (!(i.variantId in map)) return [i];
        const info = map[i.variantId];
        const stock = Math.max(0, Number(info?.stock) || 0);
        if (!info || stock === 0) {
          removed.push(i.productName);
          return [];
        }
        const quantity = Math.min(i.quantity, stock);
        if (quantity < i.quantity) adjusted.push(i.productName);
        const price = Number.isFinite(info.price) ? Number(info.price) : i.price;
        if (price !== i.price) priceChanged.push(i.productName);
        return [{ ...i, quantity, stock, price }];
      }),
    );

    return { removed, adjusted, priceChanged };
  };

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addItem,
      removeItem,
      updateQuantity,
      syncAvailability,

      clear: () => setItems([]),
      total: items.reduce((s, i) => s + i.price * i.quantity, 0),
      count: items.reduce((s, i) => s + i.quantity, 0),
      lastAddedKey,
    }),
    [items, isOpen, lastAddedKey],
  );


  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
