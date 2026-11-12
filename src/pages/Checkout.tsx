import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart, cartKey } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPrice, pixPrice, installmentPrice, INSTALLMENTS } from "@/lib/format";
import { WHATSAPP_NUMBER, PIX_KEY, PIX_MERCHANT_NAME, PIX_MERCHANT_CITY } from "@/config/site";
import { MessageCircle, ShoppingBag, Copy, Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { buildPixPayload } from "@/lib/pix";
import QRCode from "qrcode";

type Delivery = "delivery" | "pickup";
type Payment = "pix" | "cash" | "card";

const Checkout = () => {
  const { items, total, clear, syncAvailability } = useCart();
  const navigate = useNavigate();


  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [delivery, setDelivery] = useState<Delivery>("delivery");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [reference, setReference] = useState("");
  const [payment, setPayment] = useState<Payment>("pix");
  const [pixConfirmed, setPixConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Mantém a referência atual dos itens sem recriar a revalidação a cada render
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Última revalidação bem-sucedida (assinatura do carrinho + timestamp),
  // usada para evitar chamadas duplicadas em sequência.
  const lastCheckRef = useRef<{ signature: string; at: number } | null>(null);
  const REVALIDATE_TTL = 5000;

  /**
   * Consulta o estoque/preço reais das variantes e ajusta o carrinho.
   * Retorna `ok: false` quando algo mudou e o pedido não deve seguir.
   */
  const revalidateCart = useCallback(
    async (force = false): Promise<{ ok: boolean }> => {
      const current = itemsRef.current;
      if (current.length === 0) return { ok: false };

      const signature = current
        .map((i) => `${cartKey(i.variantId, i.size)}:${i.quantity}`)
        .sort()
        .join("|");
      const last = lastCheckRef.current;
      if (!force && last && last.signature === signature && Date.now() - last.at < REVALIDATE_TTL) {
        return { ok: true };
      }

      const ids = Array.from(new Set(current.map((i) => i.variantId)));
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, stock, price, products(is_active)")
        .in("id", ids);

      if (error) {
        toast({
          title: "Não foi possível verificar o estoque",
          description: "Verifique sua conexão e tente novamente.",
          variant: "destructive",
        });
        return { ok: false };
      }

      const byId = new Map((data ?? []).map((v) => [v.id, v]));
      const map: Record<string, { stock: number; price: number } | null> = {};
      ids.forEach((id) => {
        const found = byId.get(id) as
          | { id: string; stock: number | null; price: number | null; products?: { is_active?: boolean } | { is_active?: boolean }[] | null }
          | undefined;
        const productRel = Array.isArray(found?.products) ? found?.products[0] : found?.products;
        // Produto inativo é tratado como indisponível, mesmo com estoque.
        const active = productRel?.is_active !== false;
        map[id] =
          found && active
            ? { stock: Number(found.stock) || 0, price: Number(found.price) || 0 }
            : null;
      });

      const { removed, adjusted, priceChanged } = syncAvailability(map);
      const changed = removed.length > 0 || adjusted.length > 0 || priceChanged.length > 0;

      if (changed) {
        const parts: string[] = [];
        if (removed.length) parts.push(`Indisponível: ${removed.join(", ")}.`);
        if (adjusted.length) parts.push(`Quantidade ajustada: ${adjusted.join(", ")}.`);
        if (priceChanged.length) parts.push(`Preço atualizado: ${priceChanged.join(", ")}.`);
        toast({
          title: "Carrinho atualizado",
          description: `${parts.join(" ")} Revise seu pedido antes de enviar.`,
          variant: "destructive",
        });
        lastCheckRef.current = null;
        return { ok: false };
      }

      lastCheckRef.current = { signature, at: Date.now() };
      return { ok: true };
    },
    [syncAvailability],
  );

  // Revalida o carrinho ao abrir o checkout (ex.: após refresh na página)
  const mountedCheckRef = useRef(false);
  useEffect(() => {
    if (mountedCheckRef.current || items.length === 0) return;
    mountedCheckRef.current = true;
    void revalidateCart(true);
  }, [items.length, revalidateCart]);


  const copyTimer = useRef<number | null>(null);
  useEffect(() => () => { if (copyTimer.current) window.clearTimeout(copyTimer.current); }, []);

  // Payload BR Code estático com valor — recalculado sempre que o total muda
  const pixPayload = React.useMemo(
    () =>
      buildPixPayload({
        key: PIX_KEY,
        amount: pixPrice(total),
        merchantName: PIX_MERCHANT_NAME,
        merchantCity: PIX_MERCHANT_CITY,
      }),
    [total],
  );

  const [pixQrImage, setPixQrImage] = useState<string>("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(pixPayload, { margin: 0, width: 320, errorCorrectionLevel: "M" })
      .then((url) => { if (active) setPixQrImage(url); })
      .catch(() => { if (active) setPixQrImage(""); });
    return () => { active = false; };
  }, [pixPayload]);

  const copyPixKey = async () => {
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      toast({ title: "Pix copia e cola copiado!" });
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = pixPayload;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
        toast({ title: "Pix copia e cola copiado!" });
        if (copyTimer.current) window.clearTimeout(copyTimer.current);
        copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
      } catch {
        toast({ title: "Não foi possível copiar", variant: "destructive" });
      }
    }
  };


  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center flex flex-col items-center gap-4">
        <ShoppingBag className="w-16 h-16 text-muted-foreground/30" aria-hidden="true" />
        <h1 className="text-2xl font-black">Seu carrinho está vazio</h1>
        <p className="text-muted-foreground">Adicione produtos para finalizar o pedido.</p>
        <Button onClick={() => navigate("/produtos")}>Ver produtos</Button>
      </div>
    );
  }

  const ADDRESS_FIELDS = ["cep", "city", "street", "number", "neighborhood"];

  // Ao trocar a forma de entrega, descarta erros que deixaram de fazer sentido
  const changeDelivery = (next: Delivery) => {
    if (next === delivery) return;
    setDelivery(next);
    setErrors((prev) => {
      const cleaned = { ...prev };
      ADDRESS_FIELDS.forEach((k) => delete cleaned[k]);
      return cleaned;
    });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim() || name.length > 100) e.name = "Informe seu nome (até 100 caracteres).";
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 13) e.phone = "Informe um telefone válido com DDD.";
    if (delivery === "delivery") {
      if (cep.replace(/\D/g, "").length !== 8) e.cep = "Informe um CEP válido (8 dígitos).";
      if (!city.trim() || city.length > 100) e.city = "Informe a cidade.";
      if (!street.trim() || street.length > 150) e.street = "Informe a rua.";
      if (!number.trim() || number.length > 20) e.number = "Informe o número.";
      if (!neighborhood.trim() || neighborhood.length > 100) e.neighborhood = "Informe o bairro.";
    }
    if (payment === "pix" && !pixConfirmed) e.pix = "Confirme que o pagamento via Pix foi realizado.";
    setErrors(e);
    return e;
  };

  const FIELD_ORDER = ["name", "phone", "cep", "city", "street", "number", "neighborhood", "pix"];

  const focusFirstError = (e: Record<string, string>) => {
    const key = FIELD_ORDER.find((k) => e[k]);
    if (!key) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${key}"], #pix-confirm`);
    const target = key === "pix" ? formRef.current?.querySelector<HTMLElement>("#pix-confirm") : el;
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => target.focus({ preventScroll: true }), 300);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      toast({ title: "Preencha os campos obrigatórios para continuar." });
      focusFirstError(errs);
      return;
    }

    // Segunda proteção: confere estoque/preço imediatamente antes de enviar
    setSubmitting(true);
    const { ok } = await revalidateCart(true);
    setSubmitting(false);
    if (!ok) return;


    const waPaymentLabel = { pix: "PIX", cash: "Dinheiro", card: "Cartão" }[payment];
    const deliveryLabel = delivery === "delivery" ? "Em casa" : "Retirada";


    const lines: string[] = [];
    lines.push("🛒 *NOVO PEDIDO - OJUARA SUPLEMENTOS*");
    lines.push("");
    lines.push("👤 *Cliente*");
    lines.push(`• Nome: ${name}`);
    lines.push(`• Telefone: ${phone}`);
    lines.push("");
    lines.push("🚚 *Forma de entrega*");
    lines.push(`• ${deliveryLabel}`);
    if (delivery === "delivery") {
      lines.push("");
      lines.push("📍 *Endereço*");
      lines.push(`• CEP: ${cep}`);
      lines.push(`• ${street}, ${number}${complement ? ` — ${complement}` : ""}`);
      lines.push(`• Bairro: ${neighborhood}`);
      lines.push(`• Cidade: ${city}`);
      if (reference.trim()) lines.push(`• Ponto de referência: ${reference}`);
    }
    lines.push("");
    lines.push("💳 *Forma de pagamento*");
    lines.push(`• ${waPaymentLabel}`);
    if (payment === "pix") {
      lines.push("Cliente orientado a enviar o comprovante após o envio do pedido.");
    }
    lines.push("");
    lines.push("📦 *Itens do pedido*");
    items.forEach((i) => {
      lines.push(`${i.quantity}x ${i.productName}`);
      if (i.flavor) lines.push(`• Sabor: ${i.flavor}`);
      if (i.size) lines.push(`• Variação: ${i.size}`);
      lines.push(`• Valor: ${formatPrice(i.price * i.quantity)}`);
      lines.push("");
    });
    lines.push("────────────────────");
    lines.push("💰 *Resumo*");
    if (payment === "pix") {
      const discount = total - pixPrice(total);
      lines.push(`Subtotal: ${formatPrice(total)}`);
      lines.push(`Desconto PIX (5%): -${formatPrice(discount)}`);
      lines.push(`Total: *${formatPrice(pixPrice(total))}*`);
    } else {
      lines.push(`Total: *${formatPrice(total)}*`);
    }

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
    const newWindow = window.open(url, "_blank");
    if (!newWindow) {
      window.location.href = url;
    }
    clear();
    navigate("/");
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-2xl md:text-3xl font-black mb-6">Finalizar pedido</h1>
      <div className="grid md:grid-cols-[1fr_360px] gap-8">
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6 bg-card p-6 rounded-xl border border-border">
          <Section title="Seus dados">
            <Field label="Nome completo" required error={errors.name}>
              <Input name="name" autoFocus required value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Seu nome" />
            </Field>
            <Field label="Telefone (WhatsApp)" required error={errors.phone}>
              <Input name="phone" required type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="(11) 99999-9999" />
            </Field>
          </Section>

          <Section title="Forma de entrega">
            <div className="grid grid-cols-2 gap-3">
              <ChoiceCard active={delivery === "delivery"} onClick={() => changeDelivery("delivery")}>Em casa</ChoiceCard>
              <ChoiceCard active={delivery === "pickup"} onClick={() => changeDelivery("pickup")}>Retirada</ChoiceCard>
            </div>
            {delivery === "delivery" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="CEP" required error={errors.cep}>
                  <Input name="cep" required inputMode="numeric" value={cep} onChange={(e) => setCep(e.target.value)} maxLength={10} placeholder="00000-000" />
                </Field>
                <Field label="Cidade" required error={errors.city}>
                  <Input name="city" required value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} placeholder="Cidade" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Rua / Avenida" required error={errors.street}>
                    <Input name="street" required value={street} onChange={(e) => setStreet(e.target.value)} maxLength={150} placeholder="Nome da rua" />
                  </Field>
                </div>
                <Field label="Número" required error={errors.number}>
                  <Input name="number" required value={number} onChange={(e) => setNumber(e.target.value)} maxLength={20} placeholder="123" />
                </Field>
                <Field label="Complemento">
                  <Input value={complement} onChange={(e) => setComplement(e.target.value)} maxLength={100} placeholder="Apto, bloco (opcional)" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Bairro" required error={errors.neighborhood}>
                    <Input name="neighborhood" required value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} maxLength={100} placeholder="Bairro" />
                  </Field>
                </div>

                <div className="sm:col-span-2">
                  <Field label="Ponto de referência">
                    <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={200} placeholder="Próximo a... (opcional)" />
                  </Field>
                </div>
              </div>
            )}
          </Section>

          <Section title="Pagamento">
            <div className="grid grid-cols-3 gap-3">
              <ChoiceCard active={payment === "pix"} onClick={() => setPayment("pix")}>Pix</ChoiceCard>
              <ChoiceCard active={payment === "cash"} onClick={() => setPayment("cash")}>Dinheiro</ChoiceCard>
              <ChoiceCard active={payment === "card"} onClick={() => setPayment("card")}>Cartão</ChoiceCard>
            </div>

            {payment === "pix" && (
              <div className="rounded-xl border border-border bg-background p-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Escaneie o QR Code abaixo ou copie a chave Pix para pagar{" "}
                  <span className="font-bold text-foreground">{formatPrice(pixPrice(total))}</span> (5% de desconto já
                  aplicado).
                </p>

                <div className="flex flex-col items-center gap-4">
                  {pixQrImage && (
                    <img
                      src={pixQrImage}
                      alt="QR Code para pagamento via Pix"
                      className="w-40 h-40 rounded-lg bg-white p-2 border border-border"
                      loading="lazy"
                    />
                  )}
                  <div className="flex-1 w-full space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={copyPixKey}
                      className="w-full h-11 justify-center gap-2 font-medium"
                      aria-label="Copiar chave Pix copia e cola"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          Chave Pix copiada!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Pix copia e cola
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/40 p-3 flex gap-2.5 items-start">
                  <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
                    Após realizar o pagamento via PIX, envie o comprovante junto com a mensagem que será aberta no
                    WhatsApp para que possamos confirmar seu pedido mais rapidamente.
                  </p>
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <Checkbox
                    id="pix-confirm"
                    aria-label="Confirmo que já realizei o pagamento via Pix"
                    checked={pixConfirmed}
                    onCheckedChange={(v) => setPixConfirmed(v === true)}
                  />

                  <Label htmlFor="pix-confirm" className="text-sm font-medium leading-snug cursor-pointer">
                    Confirmo que já realizei o pagamento via Pix
                  </Label>
                </div>
                {!pixConfirmed && (
                  <p className="text-xs text-muted-foreground">
                    Confirme que o pagamento foi realizado para habilitar o envio do pedido.
                  </p>
                )}
                {errors.pix && <p className="text-xs text-destructive">{errors.pix}</p>}
              </div>
            )}
          </Section>

          <Button
            type="submit"
            disabled={(payment === "pix" && !pixConfirmed) || submitting}
            className="w-full h-12 text-base font-bold gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-auto"
          >
            <MessageCircle className="w-5 h-5" />
            {submitting ? "Verificando estoque..." : "Enviar pedido no WhatsApp"}
          </Button>


        </form>

        {/* Summary */}
        <aside className="bg-card p-6 rounded-xl border border-border h-fit md:sticky md:top-20">
          <h3 className="font-bold mb-4">Resumo do pedido</h3>
          <ul className="space-y-3 mb-4">
            {items.map((i) => (
              <li key={cartKey(i.variantId, i.size)} className="flex justify-between gap-3 text-sm">
                <span className="flex-1">
                  <span className="font-semibold">{i.quantity}x</span> {i.productName}
                  {(i.flavor || i.size) && (
                    <span className="block text-xs text-muted-foreground">
                      {[i.flavor, i.size].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <span className="font-medium">{formatPrice(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border pt-3 flex justify-between items-start gap-3">
            <span className="font-bold pt-0.5">Total</span>
            <div className="flex flex-col items-end leading-tight">
              {payment === "pix" ? (
                <>
                  <span className="text-xl font-black text-primary">{formatPrice(pixPrice(total))}</span>
                  <span className="text-xs text-muted-foreground">
                    no Pix (5% off) · ou {formatPrice(total)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xl font-black text-primary">{formatPrice(total)}</span>
                  <span className="text-xs text-muted-foreground">
                    {INSTALLMENTS}x de {formatPrice(installmentPrice(total))} sem juros
                  </span>
                </>
              )}
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const id = React.useId();
  const errorId = `${id}-error`;
  const control = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId : undefined,
      })
    : children;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {control}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "p-3 rounded-lg border-2 text-sm font-bold transition-fast min-h-11",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-border bg-background hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}

export default Checkout;
