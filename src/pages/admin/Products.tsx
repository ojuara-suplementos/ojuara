import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Filter, Download, Search, Loader2, ChevronDown, Minus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAllProducts, useCategories } from "@/hooks/useProducts";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { formatPrice, cheapestVariant } from "@/lib/format";
import { syncProductActive, OUT_OF_STOCK_TOAST } from "@/lib/stock";
import { deleteProductCompletely } from "@/lib/products";
import type { Product } from "@/types/catalog";

const PAGE_SIZE = 8;

export default function AdminProducts() {
  const { data: products = [], isLoading } = useAllProducts();
  const { data: categories = [] } = useCategories();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [stockBusy, setStockBusy] = useState<string | null>(null);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const updateStock = async (product: Product, variantId: string, nextStock: number) => {
    if (nextStock < 0) return;
    setStockBusy(variantId);
    // Optimistic update
    qc.setQueriesData<Product[]>({ queryKey: ["products"] }, (old) =>
      old?.map((p) => ({
        ...p,
        product_variants: p.product_variants.map((v) =>
          v.id === variantId ? { ...v, stock: nextStock } : v,
        ),
      })),
    );
    const { error } = await supabase
      .from("product_variants")
      .update({ stock: nextStock })
      .eq("id", variantId);
    if (error) {
      setStockBusy(null);
      toast({ title: "Erro ao atualizar estoque", description: error.message, variant: "destructive" });
      qc.invalidateQueries({ queryKey: ["products"] });
      return;
    }

    // Fonte única de verdade para a auto-inativação
    const nextVariants = product.product_variants.map((v) =>
      v.id === variantId ? { ...v, stock: nextStock } : v,
    );
    const deactivated = await syncProductActive(product.id, nextVariants, product.is_active);
    if (deactivated) {
      qc.setQueriesData<Product[]>({ queryKey: ["products"] }, (old) =>
        old?.map((p) => (p.id === product.id ? { ...p, is_active: false } : p)),
      );
      toast(OUT_OF_STOCK_TOAST);
    }
    setStockBusy(null);
  };


  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (term && !p.name.toLowerCase().includes(term) && !p.slug.toLowerCase().includes(term))
        return false;
      if (categoryFilter !== "all" && p.category_id !== categoryFilter) return false;
      if (statusFilter === "active" && !p.is_active) return false;
      if (statusFilter === "inactive" && p.is_active) return false;
      return true;
    });
  }, [products, search, categoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Mantém a paginação válida quando os filtros reduzem a lista
  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);





  const toggleActive = async (p: Product) => {
    const totalStock = p.product_variants.reduce((s, v) => s + (v.stock ?? 0), 0);
    if (!p.is_active && totalStock === 0) {
      toast({
        title: "Produto esgotado",
        description: "Adicione estoque em alguma variante para ativar o produto.",
        variant: "destructive",
      });
      return;
    }
    setBusyId(p.id);
    const { error } = await supabase
      .from("products")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["products"] });
    toast({ title: !p.is_active ? "Produto ativado" : "Produto inativado" });
  };

  const handleDelete = async () => {
    if (!toDelete || busyId === toDelete.id) return;
    setBusyId(toDelete.id);
    try {
      await deleteProductCompletely(toDelete.id);
      toast({ title: "Produto excluído" });
      qc.invalidateQueries({ queryKey: ["products"] });
      setToDelete(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tente novamente.";
      toast({ title: "Erro ao excluir", description: message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };


  const handleExport = () => {
    const headers = ["nome", "slug", "categoria", "marca", "preco", "ativo"];
    const rows = filtered.map((p) => {
      const variant = cheapestVariant(p.product_variants);
      return [
        p.name,
        p.slug,
        p.categories?.name ?? "",
        p.brands?.name ?? "",
        variant ? Number(variant.price).toFixed(2) : "",
        p.is_active ? "sim" : "nao",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "produtos-ojuara.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-display">Produtos</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              Gerencie o inventário de suplementos de alta performance da Ojuara. Controle preços,
              disponibilidade e catálogo.
            </p>
          </div>
          <Button asChild className="font-display uppercase tracking-wider shadow-glow">
            <Link to="/admin/produtos/novo">
              <Plus className="h-4 w-4 mr-2" /> Novo Produto
            </Link>
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do produto ou slug..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10 h-12 bg-card"
            />
          </div>
          <div className="grid grid-cols-2 md:flex gap-3">
            <Select
              value={categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-12 md:min-w-[160px] bg-card">
                <Filter className="h-4 w-4 mr-2 shrink-0" />
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-12 md:min-w-[140px] bg-card">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-12 col-span-2 md:col-span-1" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Exportar
            </Button>
          </div>
        </div>

        {/* Table header */}
        <div className="hidden md:grid grid-cols-[1fr_140px_140px_120px] gap-4 px-4 text-[11px] font-display tracking-[0.2em] uppercase text-muted-foreground">
          <span>Produto</span>
          <span>Preço</span>
          <span>Status</span>
          <span className="text-right">Ações</span>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : pageItems.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-12 text-center">
              <p className="text-muted-foreground">Nenhum produto encontrado.</p>
            </div>
          ) : (
            pageItems.map((p) => {
              const variant = cheapestVariant(p.product_variants);
              const isOpen = expanded.has(p.id);
              const totalStock = p.product_variants.reduce((s, v) => s + (v.stock ?? 0), 0);
              return (
                <div key={p.id} className="bg-card border border-border rounded-lg">
                  <div className="p-4 grid grid-cols-1 md:grid-cols-[1fr_140px_140px_120px] gap-4 items-center">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-14 w-14 rounded bg-muted overflow-hidden shrink-0 grid place-items-center">
                        {variant?.image_url ? (
                          <img
                            src={variant.image_url}
                            alt={p.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">N/A</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-display tracking-wide uppercase text-sm md:text-base truncate">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground tracking-wide">
                          SKU: {p.slug.toUpperCase()} · Estoque: {totalStock}
                        </p>
                      </div>
                    </div>

                    <p className="font-display text-base md:text-lg">
                      {variant ? formatPrice(Number(variant.price)) : "—"}
                    </p>

                    <div className="flex items-center gap-3">
                      <Switch
                        checked={p.is_active}
                        disabled={busyId === p.id}
                        onCheckedChange={() => toggleActive(p)}
                      />
                      <span
                        className={`text-[11px] font-display uppercase tracking-wider ${
                          p.is_active ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {p.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="icon">
                        <Link to={`/admin/produtos/${p.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground"
                        onClick={() => setToDelete(p)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleExpanded(p.id)}
                        aria-label={isOpen ? "Recolher estoque" : "Expandir estoque"}
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </Button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-border p-4 space-y-2 bg-background/40">
                      <p className="text-[11px] font-display uppercase tracking-[0.2em] text-muted-foreground mb-3">
                        Estoque por variante
                      </p>
                      {p.product_variants.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sem variantes cadastradas.</p>
                      ) : (
                        p.product_variants.map((v) => {
                          const stock = v.stock ?? 0;
                          return (
                            <div
                              key={v.id}
                              className="flex items-center justify-between gap-3 py-2 border-b border-border/60 last:border-b-0"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-display uppercase tracking-wide truncate">
                                  {v.name}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  {(v.size ?? "")
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                    .map((s) => (
                                      <span
                                        key={s}
                                        className="text-[10px] font-display uppercase tracking-wider px-2 py-0.5 rounded border border-border bg-background text-foreground/80"
                                      >
                                        {s}
                                      </span>
                                    ))}
                                  {!v.size && (
                                    <span className="text-[11px] text-muted-foreground">—</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={stockBusy === v.id || stock <= 0}
                                  onClick={() => updateStock(p, v.id, stock - 1)}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </Button>
                                <Input
                                  type="number"
                                  min={0}
                                  value={stock}
                                  onChange={(e) => {
                                    const n = Math.max(0, Number(e.target.value) || 0);
                                    qc.setQueriesData<Product[]>(
                                      { queryKey: ["products"] },
                                      (old) =>
                                        old?.map((pp) => ({
                                          ...pp,
                                          product_variants: pp.product_variants.map((vv) =>
                                            vv.id === v.id ? { ...vv, stock: n } : vv,
                                          ),
                                        })),
                                    );
                                  }}
                                  onBlur={(e) =>
                                    updateStock(p, v.id, Math.max(0, Number(e.target.value) || 0))
                                  }
                                  className="h-8 w-16 text-center"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={stockBusy === v.id}
                                  onClick={() => updateStock(p, v.id, stock + 1)}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {!isLoading && filtered.length > 0 && (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-4 border-t border-border">
            <p className="text-[11px] font-display uppercase tracking-wider text-muted-foreground">
              Exibindo {pageItems.length} de {filtered.length} produtos registrados
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹
              </Button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={page === i + 1 ? "default" : "outline"}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                ›
              </Button>
            </div>
          </div>
        )}
        {busyId && (
          <div className="fixed bottom-4 right-4 bg-card border border-border rounded-lg px-4 py-2 flex items-center gap-2 shadow-card">
            <Loader2 className="h-4 w-4 animate-spin" /> Atualizando...
          </div>
        )}
      </div>

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && busyId !== toDelete?.id && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O produto "{toDelete?.name}" e suas variantes serão
              removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId === toDelete?.id}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={busyId === toDelete?.id}
              className="bg-destructive disabled:opacity-60 disabled:pointer-events-none"
            >
              {busyId === toDelete?.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {busyId === toDelete?.id ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>

        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
