import { FormEvent, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Save, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Skeleton } from "@/components/ui/skeleton";
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
import { toast } from "@/hooks/use-toast";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const DESCRIPTION_MAX = 180;

interface Item {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
}

interface Props {
  table: "categories" | "brands";
  title: string;
  description: string;
  withSlug?: boolean;
  withDescription?: boolean;
}


export function TaxonomyManager({ table, title, description, withSlug = false, withDescription = false }: Props) {
  const qc = useQueryClient();
  const queryKey = [table];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase.from(table).select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [desc, setDesc] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);

  const startEdit = (item: Item | "new") => {
    setEditing(item);
    setSlugTouched(item !== "new");
    if (item === "new") {
      setName("");
      setSlug("");
      setDesc("");
    } else {
      setName(item.name);
      setSlug(item.slug ?? "");
      setDesc(item.description ?? "");
    }
  };

  const reset = () => {
    setEditing(null);
    setName("");
    setSlug("");
    setDesc("");
    setSlugTouched(false);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (withSlug && !slugTouched) setSlug(slugify(value));
  };

  const handleSlugChange = (value: string) => {
    setSlug(slugify(value));
    setSlugTouched(true);
  };

  const descTooLong = desc.length > DESCRIPTION_MAX;

  const duplicateMessage =
    table === "categories" ? "Esta categoria já existe." : "Esta marca já existe.";
  const normalize = (s: string) =>
    s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

  const isDuplicateError = (err: { code?: string; message?: string }) =>
    err.code === "23505" || /duplicate key|unique constraint/i.test(err.message ?? "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (withDescription && descTooLong) return;

    // Bloqueio de duplicidade (case/acento/espaço insensível)
    const target = normalize(name);
    const clash = items.some(
      (i) => normalize(i.name) === target && (editing === "new" || i.id !== (editing as Item).id),
    );
    if (clash) {
      toast({ title: duplicateMessage, variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload: Record<string, unknown> = { name: name.trim() };
    if (withSlug) payload.slug = (slug.trim() || slugify(name)) as string;
    if (withDescription) payload.description = desc.trim() || null;


    const { error } =
      editing === "new"
        ? await supabase.from(table).insert(payload)
        : await supabase.from(table).update(payload).eq("id", (editing as Item).id);

    setSaving(false);
    if (error) {
      toast({
        title: isDuplicateError(error) ? duplicateMessage : "Erro ao salvar",
        description: isDuplicateError(error) ? undefined : "Tente novamente em instantes.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: editing === "new" ? "Criado" : "Atualizado" });
    qc.invalidateQueries({ queryKey });
    reset();
  };

  const handleDelete = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    const column = table === "categories" ? "category_id" : "brand_id";
    const { count, error: countError } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq(column, toDelete.id);

    if (countError) {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível verificar os produtos vinculados. Tente novamente.",
        variant: "destructive",
      });
      setDeleting(false);
      setToDelete(null);
      return;
    }

    if ((count ?? 0) > 0) {
      toast({
        title:
          table === "categories"
            ? "Não é possível excluir esta categoria porque existem produtos vinculados a ela."
            : "Não é possível excluir esta marca porque existem produtos vinculados a ela.",
        variant: "destructive",
      });
      setDeleting(false);
      setToDelete(null);
      return;
    }

    const { error } = await supabase.from(table).delete().eq("id", toDelete.id);
    if (error) {
      toast({
        title: "Erro ao excluir",
        description:
          error.code === "23503"
            ? "Existem produtos vinculados a este item."
            : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Removido" });
      qc.invalidateQueries({ queryKey });
    }
    setDeleting(false);
    setToDelete(null);
  };



  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-display">{title}</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">{description}</p>
          </div>
          <Button onClick={() => startEdit("new")} className="font-display uppercase shadow-glow">
            <Plus className="h-4 w-4 mr-2" /> Novo
          </Button>
        </div>

        {editing && (
          <form
            onSubmit={handleSubmit}
            className="bg-card border border-border rounded-lg p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display">{editing === "new" ? "Adicionar" : "Editar"}</h2>
              <Button type="button" variant="ghost" size="icon" onClick={reset}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => handleNameChange(e.target.value)} required autoFocus />
              {withSlug && name && (
                <p className="text-[11px] text-muted-foreground">/{slugify(name)}</p>
              )}
            </div>
            {withDescription && (
              <div className="space-y-2">
                <Label htmlFor="taxonomy-description">Descrição</Label>
                <Textarea
                  id="taxonomy-description"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  maxLength={DESCRIPTION_MAX}
                  rows={3}
                  placeholder="Texto curto exibido na página da categoria."
                  className="resize-none"
                />
                <p
                  className={`text-[11px] text-right ${descTooLong ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {desc.length}/{DESCRIPTION_MAX}
                </p>
              </div>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || (withDescription && descTooLong)}>

                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : items.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground">
              Nenhum item cadastrado.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="bg-card border border-border rounded-lg px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-display tracking-wide uppercase text-sm">{item.name}</p>
                  {withSlug && item.slug && (
                    <p className="text-[11px] text-muted-foreground">/{item.slug}</p>
                  )}
                  {withDescription && item.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                  )}

                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => setToDelete(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Produtos vinculados a este item ficarão sem vínculo. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive disabled:opacity-60 disabled:pointer-events-none"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {deleting ? "Removendo..." : "Remover"}
            </AlertDialogAction>

          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
