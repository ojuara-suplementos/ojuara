import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCategories, useBrands } from "@/hooks/useProducts";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

import { ImageUpload } from "@/components/admin/ImageUpload";
import { CurrencyInput } from "@/components/admin/CurrencyInput";
import { cn } from "@/lib/utils";
import { normalizeFlavor, normalizeProductName, normalizeSize } from "@/lib/normalize";
import { syncProductActive, OUT_OF_STOCK_TOAST } from "@/lib/stock";
import { removeStorageImages, removeUnusedUploads } from "@/lib/storage";
import type { ProductVariant } from "@/types/catalog";

interface VariationDraft {
  _key: string;
  id?: string;
  size: string;
  price?: number;
  original_price?: number | null;
  stock?: number;
  /** Imagem específica desta variação (tem prioridade sobre a imagem do sabor). */
  image_url?: string;
}

interface FlavorGroup {
  _key: string;
  flavor: string;
  variations: VariationDraft[];
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/**
 * Garante um slug único: se já existir outro produto com o mesmo slug,
 * acrescenta um sufixo numérico (-2, -3, ...).
 */
const uniqueSlug = async (name: string, currentId?: string): Promise<string> => {
  const base = slugify(name) || "produto";
  const { data, error } = await supabase
    .from("products")
    .select("id, slug")
    .like("slug", `${base}%`);
  if (error) return base;
  const taken = new Set(
    (data ?? []).filter((p) => p.id !== currentId).map((p) => p.slug as string),
  );
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
};



const newVariation = (): VariationDraft => ({ _key: crypto.randomUUID(), size: "" });
const newFlavor = (): FlavorGroup => ({
  _key: crypto.randomUUID(),
  flavor: "",
  variations: [newVariation()],
});

const errKey = (...parts: string[]) => parts.join(":");

export default function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "novo";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const touch = (...keys: string[]) =>
    setTouched((t) => {
      const next = new Set(t);
      keys.forEach((k) => next.add(k));
      return next;
    });


  const [form, setForm] = useState({
    name: "",
    description: "",
    benefits: "",
    nutrition: "",
    category_id: "",
    brand_id: "",
    is_kit: false,
    is_active: true,
  });
  const [groups, setGroups] = useState<FlavorGroup[]>([newFlavor()]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const nameRef = useRef<HTMLInputElement>(null);
  const initialImagesRef = useRef<string[]>([]);
  // Uploads feitos nesta sessão de edição — descartados caso o produto não seja salvo
  const sessionUploadsRef = useRef<string[]>([]);
  const savedRef = useRef(false);
  const trackUpload = (url: string) => {
    if (url) sessionUploadsRef.current = [...sessionUploadsRef.current, url];
  };
  // Registra imagens substituídas para limpeza no storage após salvar
  const trackReplacedImage = (previous: string, next: string) => {
    if (previous && previous !== next && !initialImagesRef.current.includes(previous)) {
      initialImagesRef.current = [...initialImagesRef.current, previous];
    }
  };

  // Ao sair sem salvar, remove os uploads órfãos desta sessão
  useEffect(
    () => () => {
      if (savedRef.current || sessionUploadsRef.current.length === 0) return;
      void removeUnusedUploads(sessionUploadsRef.current);
    },
    [],
  );

  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) nameRef.current?.focus();
  }, [loading]);

  useEffect(() => {
    if (!pendingFocus) return;
    const el = document.querySelector<HTMLInputElement>(`[data-focus-key="${pendingFocus}"]`);
    el?.focus();
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setPendingFocus(null);
  }, [pendingFocus, groups]);



  useEffect(() => {
    if (isNew || !id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_variants(*)")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast({ title: "Produto não encontrado", variant: "destructive" });
        navigate("/admin/produtos");
        return;
      }
      setForm({
        name: data.name ?? "",
        description: data.description ?? "",
        benefits: data.benefits ?? "",
        nutrition: data.nutrition ?? "",
        category_id: data.category_id ?? "",
        brand_id: data.brand_id ?? "",
        is_kit: data.type === "kit",
        
        is_active: !!data.is_active,
      });

      initialImagesRef.current = [
        data.nutrition ?? "",
        ...((data.product_variants ?? []) as ProductVariant[]).map((v) => v.image_url ?? ""),
      ].filter(Boolean);



      const byFlavor = new Map<string, FlavorGroup>();
      for (const v of (data.product_variants ?? []) as ProductVariant[]) {
        const flavor = (v.flavor ?? "").trim();
        const existing = byFlavor.get(flavor);
        const variation: VariationDraft = {
          _key: v.id,
          id: v.id,
          size: (v.size ?? "").trim(),
          price: v.price == null ? undefined : Number(v.price),
          original_price: v.original_price == null ? null : Number(v.original_price),
          stock: v.stock == null ? undefined : Number(v.stock),
          image_url: v.image_url ?? "",
        };
        if (existing) {
          existing.variations.push(variation);
        } else {
          byFlavor.set(flavor, {
            _key: crypto.randomUUID(),
            flavor,
            variations: [variation],
          });
        }
      }
      const loaded = [...byFlavor.values()];
      setGroups(loaded.length ? loaded : [newFlavor()]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isNew, navigate]);

  /* ---------------- mutações de estado ---------------- */

  const patchGroup = (key: string, patch: Partial<FlavorGroup>) => {
    if ("flavor" in patch) touch(errKey("g", key, "flavor"));
    setGroups((gs) => gs.map((g) => (g._key === key ? { ...g, ...patch } : g)));
  };

  const patchVariation = (gKey: string, vKey: string, patch: Partial<VariationDraft>) => {
    if ("size" in patch) touch(errKey("v", vKey, "size"));
    if ("price" in patch) touch(errKey("v", vKey, "price"), errKey("v", vKey, "original"));
    if ("original_price" in patch) touch(errKey("v", vKey, "original"));
    if ("stock" in patch) touch(errKey("v", vKey, "stock"));
    if ("image_url" in patch) touch(errKey("v", vKey, "image"));
    setGroups((gs) =>
      gs.map((g) =>
        g._key === gKey
          ? { ...g, variations: g.variations.map((v) => (v._key === vKey ? { ...v, ...patch } : v)) }
          : g,
      ),
    );
  };


  const addFlavor = () => {
    const g = newFlavor();
    setGroups((gs) => [...gs, g]);
    setPendingFocus(g._key);
    toast({ title: "Sabor / cor adicionado" });
  };

  const removeFlavor = (key: string) => {
    if (groups.length <= 1) {
      toast({ title: "O produto deve possuir pelo menos um sabor / cor." });
      return;
    }
    const target = groups.find((g) => g._key === key);
    const ids = target?.variations.flatMap((v) => (v.id ? [v.id] : [])) ?? [];
    if (ids.length) setDeletedIds((d) => [...d, ...ids]);
    setGroups((gs) => gs.filter((g) => g._key !== key));
    toast({ title: "Sabor / cor removido" });
  };

  const addVariation = (gKey: string) => {
    const v = newVariation();
    setGroups((gs) =>
      gs.map((g) => (g._key === gKey ? { ...g, variations: [...g.variations, v] } : g)),
    );
    setPendingFocus(v._key);
    toast({ title: "Variação adicionada" });
  };

  const removeVariation = (gKey: string, vKey: string) => {
    const group = groups.find((g) => g._key === gKey);
    if (!group) return;
    if (group.variations.length <= 1) {
      toast({ title: "Cada sabor / cor deve possuir pelo menos uma variação." });
      return;
    }
    const target = group.variations.find((v) => v._key === vKey);
    if (target?.id) setDeletedIds((d) => [...d, target.id as string]);
    setGroups((gs) =>
      gs.map((g) =>
        g._key === gKey ? { ...g, variations: g.variations.filter((v) => v._key !== vKey) } : g,
      ),
    );
    toast({ title: "Variação removida" });

  };

  /* ---------------- validação ---------------- */

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Informe o nome do produto.";
    if (!form.category_id) e.category_id = "Selecione a categoria.";
    if (!form.brand_id) e.brand_id = "Selecione a marca.";

    const seen = new Set<string>();
    groups.forEach((g) => {
      if (!g.flavor.trim()) e[errKey("g", g._key, "flavor")] = "Informe o nome do sabor / cor.";
      g.variations.forEach((v, vi) => {
        if (vi === 0 && !(v.image_url ?? "").trim())
          e[errKey("v", v._key, "image")] = "Envie uma imagem para a primeira variação.";
        if (!v.size.trim()) e[errKey("v", v._key, "size")] = "Informe a variação.";
        else {
          const dup = `${g.flavor.trim().toLowerCase()}|${v.size.trim().toLowerCase()}`;
          if (seen.has(dup)) e[errKey("v", v._key, "size")] = "Variação duplicada para este sabor / cor.";
          seen.add(dup);
        }
        if (v.price == null || !(v.price > 0)) e[errKey("v", v._key, "price")] = "Preço obrigatório.";
        if (v.stock == null || !Number.isInteger(v.stock) || v.stock < 0)
          e[errKey("v", v._key, "stock")] = "Estoque obrigatório (número inteiro).";
        if (
          v.original_price != null &&
          v.original_price > 0 &&
          v.price != null &&
          v.original_price <= v.price
        )
          e[errKey("v", v._key, "original")] = "O preço original deve ser maior que o preço atual.";
      });
    });
    return e;
  }, [form, groups]);

  const isValid = Object.keys(errors).length === 0;
  const errorOf = (key: string) =>
    showErrors || touched.has(key) ? errors[key] : undefined;


  const focusFirstInvalid = () => {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('[data-invalid="true"]');
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    });
  };

  /* ---------------- salvar ---------------- */

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (!isValid) {
      const priceIssue = Object.values(errors).some((m) => m.includes("preço original"));
      toast({
        title: priceIssue
          ? "Preço original deve ser maior que o preço atual"
          : "Campos obrigatórios não preenchidos",
        description: `Corrija ${Object.keys(errors).length} campo(s) destacado(s) antes de salvar.`,
        variant: "destructive",
      });
      focusFirstInvalid();
      return;
    }

    setSaving(true);
    try {
      const name = form.name.trim();
      const payload = {
        name,
        slug: await uniqueSlug(name, id),
        description: form.description || null,
        benefits: form.benefits || null,
        nutrition: form.nutrition || null,
        category_id: form.category_id || null,
        brand_id: form.brand_id || null,
        type: form.is_kit ? "kit" : "normal",
        
        is_active: form.is_active,
      };

      let productId = id ?? "";
      // Em caso de colisão de slug (constraint UNIQUE no banco), tenta novos sufixos.
      const isSlugConflict = (e: { code?: string; message?: string }) =>
        (e.code === "23505" || /duplicate key|unique constraint/i.test(e.message ?? "")) &&
        /slug/i.test(e.message ?? "");
      const baseSlug = payload.slug;
      for (let attempt = 0; ; attempt += 1) {
        if (attempt > 0) payload.slug = `${baseSlug}-${attempt + 1}`;
        if (isNew) {
          const { data, error } = await supabase
            .from("products")
            .insert(payload)
            .select("id")
            .single();
          if (error) {
            if (isSlugConflict(error) && attempt < 5) continue;
            throw error;
          }
          productId = data.id;
        } else {
          const { error } = await supabase.from("products").update(payload).eq("id", productId);
          if (error) {
            if (isSlugConflict(error) && attempt < 5) continue;
            throw error;
          }
        }
        break;
      }


      if (deletedIds.length) {
        const { error } = await supabase.from("product_variants").delete().in("id", deletedIds);
        if (error) throw error;
      }

      const rowFor = (g: FlavorGroup, v: VariationDraft) => ({
        product_id: productId,
        name: [name, g.flavor.trim(), v.size.trim()].filter(Boolean).join(" "),
        flavor: g.flavor.trim() || null,
        size: v.size.trim() || null,
        price: Number(v.price) || 0,
        original_price: v.original_price ? Number(v.original_price) : null,
        image_url: v.image_url?.trim() || g.variations[0]?.image_url?.trim() || null,
        stock: Math.max(0, Number(v.stock) || 0),
      });

      const inserts = groups.flatMap((g) =>
        g.variations.filter((v) => !v.id).map((v) => rowFor(g, v)),
      );
      if (inserts.length) {
        const { error } = await supabase.from("product_variants").insert(inserts);
        if (error) throw error;
      }
      for (const g of groups) {
        for (const v of g.variations) {
          if (!v.id) continue;
          const { error } = await supabase
            .from("product_variants")
            .update(rowFor(g, v))
            .eq("id", v.id);
          if (error) throw error;
        }
      }

      // Limpeza de imagens órfãs (substituições, sabores/produtos removidos)
      const stillUsed = new Set(
        [
          form.nutrition,
          ...groups.flatMap((g) => g.variations.map((v) => v.image_url ?? "")),
        ].filter(Boolean),
      );
      void removeStorageImages(
        initialImagesRef.current.filter((url) => !stillUsed.has(url)),
      );
      initialImagesRef.current = [...stillUsed];
      savedRef.current = true;
      sessionUploadsRef.current = [];

      // Fonte única de verdade para a auto-inativação
      const allVariants = groups.flatMap((g) =>
        g.variations.map((v) => ({ stock: Math.max(0, Number(v.stock) || 0) })),
      );
      const deactivated = await syncProductActive(productId, allVariants, form.is_active);

      await Promise.all([
        qc.cancelQueries({ queryKey: ["products"] }),
        qc.cancelQueries({ queryKey: ["product"] }),
      ]);
      qc.removeQueries({ queryKey: ["products"] });
      qc.removeQueries({ queryKey: ["product"] });
      toast(
        deactivated
          ? OUT_OF_STOCK_TOAST
          : { title: isNew ? "Produto salvo com sucesso" : "Produto atualizado" },
      );
      navigate("/admin/produtos");

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar";
      toast({ title: "Erro ao salvar", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8" noValidate>
        <div className="flex items-center justify-between gap-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
              <Link to="/admin/produtos">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Link>
            </Button>
            <h1 className="text-2xl md:text-4xl font-display">
              {isNew ? "Novo Produto" : "Editar Produto"}
            </h1>
          </div>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn("inline-flex", !isValid && "cursor-not-allowed")}>
                  <Button
                    type="submit"
                    disabled={saving || !isValid}
                    className="font-display uppercase shadow-glow disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar
                  </Button>
                </span>
              </TooltipTrigger>
              {!isValid && (
                <TooltipContent>
                  Preencha todos os campos obrigatórios para salvar o produto.
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

        </div>

        {/* Informações gerais */}
        <section className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div>
            <h2 className="font-display text-lg">Informações gerais</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Dados do produto. Preço, estoque e imagem ficam nos sabores / cores e variações.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Nome *</Label>
              <Input
                ref={nameRef}
                value={form.name}
                placeholder="Ex: Hyper Whey Isolate"
                data-invalid={errorOf("name") ? "true" : undefined}
                aria-invalid={!!errorOf("name")}
                className={cn("h-10", errorOf("name") && "border-destructive")}
                onChange={(e) => {
                  const value = e.target.value;
                  touch("name");
                  setForm((f) => ({ ...f, name: value }));
                }}
                onBlur={(e) =>
                  setForm((f) => ({ ...f, name: normalizeProductName(e.target.value).trim() }))
                }

              />
              <FieldError message={errorOf("name")} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Select
                value={form.category_id}
                onValueChange={(v) => {
                  touch("category_id");
                  setForm((f) => ({ ...f, category_id: v }));
                }}
              >
                <SelectTrigger
                  data-invalid={errorOf("category_id") ? "true" : undefined}
                  className={cn("h-10", errorOf("category_id") && "border-destructive")}
                >
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errorOf("category_id")} />
            </div>
            <div className="space-y-1.5">
              <Label>Marca *</Label>
              <Select
                value={form.brand_id}
                onValueChange={(v) => {
                  touch("brand_id");
                  setForm((f) => ({ ...f, brand_id: v }));
                }}
              >
                <SelectTrigger
                  data-invalid={errorOf("brand_id") ? "true" : undefined}
                  className={cn("h-10", errorOf("brand_id") && "border-destructive")}
                >
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errorOf("brand_id")} />
            </div>

            <div className="md:col-span-2 flex items-center gap-6 pl-1">
              <div className="flex items-center gap-2 shrink-0">
                <Checkbox
                  id="is_kit"
                  checked={form.is_kit}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_kit: v === true }))}
                />
                <Label htmlFor="is_kit" className="cursor-pointer font-normal whitespace-nowrap">
                  É um kit
                </Label>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Checkbox
                  id="is_active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v === true }))}
                />
                <Label htmlFor="is_active" className="cursor-pointer font-normal whitespace-nowrap">
                  Produto ativo no catálogo
                </Label>
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                placeholder="Ex: Proteína isolada de alta absorção, ideal para pós-treino..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Benefícios</Label>
              <Textarea
                rows={3}
                placeholder="Ex: Ganho de massa magra, recuperação muscular, baixo teor de lactose"
                value={form.benefits}
                onChange={(e) => setForm((f) => ({ ...f, benefits: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Tabela nutricional (imagem)</Label>
              <ImageUpload
                value={form.nutrition}
                onUploaded={trackUpload}

                onChange={(url) => {
                  trackReplacedImage(form.nutrition, url);
                  setForm((f) => ({ ...f, nutrition: url }));
                  if (url) toast({ title: "Imagem enviada" });
                }}
              />
            </div>
          </div>

        </section>

        {/* Sabores e variações */}
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-lg">Sabores / cores e variações</h2>
            <p className="text-xs text-muted-foreground mt-1 w-full">
              Cada sabor / cor tem uma imagem e várias variações (500g, 900g, 30 cápsulas...). Preço,
              preço original e estoque são definidos por variação.
            </p>
          </div>


          {groups.map((g, gi) => (
              <div key={g._key} className="bg-card border border-border rounded-lg p-4 space-y-3 relative">
                <div className="absolute top-3 right-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive"
                    onClick={() => removeFlavor(g._key)}
                    aria-label="Remover sabor / cor"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label className="block pr-12 text-xs uppercase tracking-wider text-muted-foreground">
                    Sabor / Cor {gi + 1} *
                  </Label>
                  <Input
                    data-focus-key={g._key}
                    value={g.flavor}

                    placeholder="Ex: Chocolate ou Preto"
                    data-invalid={errorOf(errKey("g", g._key, "flavor")) ? "true" : undefined}
                    aria-invalid={!!errorOf(errKey("g", g._key, "flavor"))}
                    className={cn(
                      "w-full",
                      errorOf(errKey("g", g._key, "flavor")) && "border-destructive",
                    )}
                    onChange={(e) => patchGroup(g._key, { flavor: e.target.value })}
                    onBlur={(e) =>
                      patchGroup(g._key, { flavor: normalizeFlavor(e.target.value).trim() })
                    }

                  />
                  <FieldError message={errorOf(errKey("g", g._key, "flavor"))} />
                </div>


              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-display uppercase tracking-wider text-muted-foreground">
                    Variações
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="hidden lg:inline-flex"
                    onClick={() => addVariation(g._key)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Adicionar variação
                  </Button>
                </div>

                {g.variations.map((v, vi) => (
                  <div
                    key={v._key}
                    className="space-y-2 border border-border/70 rounded-md p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs">
                          {vi === 0 ? "Imagem da variação *" : "Imagem da variação (opcional)"}
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive"
                          onClick={() => removeVariation(g._key, v._key)}
                          aria-label="Remover variação"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div
                        data-invalid={errorOf(errKey("v", v._key, "image")) ? "true" : undefined}
                        tabIndex={-1}
                        className={cn(
                          "rounded-md outline-none",
                          errorOf(errKey("v", v._key, "image")) &&
                            "ring-1 ring-destructive ring-offset-2 ring-offset-background",
                        )}
                      >
                        <ImageUpload
                          value={v.image_url ?? ""}
                          onUploaded={trackUpload}
                          onChange={(url) => {
                            trackReplacedImage(v.image_url ?? "", url);
                            patchVariation(g._key, v._key, { image_url: url });
                            if (url) toast({ title: "Imagem enviada" });
                          }}
                        />
                      </div>
                      <FieldError message={errorOf(errKey("v", v._key, "image"))} />
                      {vi > 0 && (
                        <p className="text-[11px] text-muted-foreground leading-snug pl-1">
                          Se vazia, será usada a imagem da primeira variação deste sabor / cor.
                        </p>
                      )}
                    </div>


                    <div className="grid grid-cols-2 gap-2 items-start sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="col-span-2 space-y-1 sm:col-span-1">
                        <Label className="text-xs">Variação *</Label>
                        <Input
                          data-focus-key={v._key}
                          value={v.size}

                          placeholder="Ex: 900g"
                          data-invalid={errorOf(errKey("v", v._key, "size")) ? "true" : undefined}
                          aria-invalid={!!errorOf(errKey("v", v._key, "size"))}
                          className={cn(errorOf(errKey("v", v._key, "size")) && "border-destructive")}
                          onChange={(e) => patchVariation(g._key, v._key, { size: e.target.value })}
                          onBlur={(e) =>
                            patchVariation(g._key, v._key, { size: normalizeSize(e.target.value) })
                          }
                        />
                        <FieldError message={errorOf(errKey("v", v._key, "size"))} />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Label className="text-xs">Preço *</Label>
                        <CurrencyInput
                          value={v.price}
                          invalid={!!errorOf(errKey("v", v._key, "price"))}
                          onChange={(val) => patchVariation(g._key, v._key, { price: val })}
                        />
                        <FieldError message={errorOf(errKey("v", v._key, "price"))} />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Label className="text-xs">Preço original (opcional)</Label>
                        <CurrencyInput
                          placeholder="0,00"
                          value={v.original_price ?? undefined}
                          invalid={!!errorOf(errKey("v", v._key, "original"))}
                          onChange={(val) =>
                            patchVariation(g._key, v._key, { original_price: val ?? null })
                          }
                        />
                        <p className="text-[10px] leading-tight text-muted-foreground line-clamp-2 -mt-0.5">
                          Preencha apenas se estiver com desconto.
                        </p>

                        <FieldError message={errorOf(errKey("v", v._key, "original"))} />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Label className="text-xs">Estoque *</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="0"
                          value={v.stock ?? ""}
                          data-invalid={errorOf(errKey("v", v._key, "stock")) ? "true" : undefined}
                          aria-invalid={!!errorOf(errKey("v", v._key, "stock"))}
                          className={cn(errorOf(errKey("v", v._key, "stock")) && "border-destructive")}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "");
                            patchVariation(g._key, v._key, {
                              stock: digits === "" ? undefined : Number(digits),
                            });
                          }}
                        />
                        <FieldError message={errorOf(errKey("v", v._key, "stock"))} />
                      </div>
                    </div>

                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addVariation(g._key)}
                  className="w-full lg:hidden"
                >
                  <Plus className="h-4 w-4 mr-1" /> Adicionar variação
                </Button>
              </div>
            </div>
          ))}


          <Button type="button" variant="outline" onClick={addFlavor} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Adicionar sabor / cor
          </Button>
        </section>
      </form>
    </AdminLayout>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}
