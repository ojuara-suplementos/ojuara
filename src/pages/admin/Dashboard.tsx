import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAllProducts, useTopViewedProducts } from "@/hooks/useProducts";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { SmartImage } from "@/components/SmartImage";
import { TopViewedChart } from "@/components/admin/TopViewedChart";

import { formatPrice, cheapestVariant } from "@/lib/format";

export default function AdminDashboard() {
  const { data: products = [], isLoading } = useAllProducts();
  const { data: topProducts = [], isLoading: loadingTop } = useTopViewedProducts(5);

  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.is_active).length;
    return { total, active, inactive: total - active };
  }, [products]);

  const topViewed = useMemo(
    () => topProducts.map((p) => ({ id: p.id, name: p.name, views: p.view_count ?? 0 })),
    [topProducts],
  );

  const recent = useMemo(() => products.slice(0, 4), [products]);

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <p className="text-xs font-display tracking-[0.2em] text-primary uppercase">
            Painel de Controle
          </p>
          <h1 className="text-3xl md:text-5xl font-display mt-2">
            OJUARA <span className="text-muted-foreground">SUPLEMENTOS</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Total de Produtos" value={stats.total} loading={isLoading} accent />
          <StatCard label="Ativos" value={stats.active} loading={isLoading} />
          <StatCard label="Inativos" value={stats.inactive} loading={isLoading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-display mb-1">Ranking de visualizações</h2>
            <p className="text-xs text-muted-foreground mb-6">Top 5 mais visualizados</p>
            <div className="h-72 sm:h-80">
              {loadingTop ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <TopViewedChart data={topViewed} />
              )}
            </div>
          </section>


          <section className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display">Produtos recentes</h2>
              <Link
                to="/admin/produtos"
                className="text-xs font-display uppercase tracking-wider text-primary hover:underline"
              >
                Ver todos
              </Link>
            </div>
            <div className="space-y-3">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))
                : recent.map((p) => {
                    const variant = cheapestVariant(p.product_variants);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-4 p-3 rounded-md bg-secondary border border-border"
                      >
                        <div className="h-12 w-12 rounded bg-muted overflow-hidden shrink-0 grid place-items-center">
                          <SmartImage
                            src={variant?.image_url}
                            alt={p.name}
                            width={48}
                            height={48}
                            fallback={<span className="text-[10px] text-muted-foreground">N/A</span>}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{p.name}</p>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {p.categories?.name ?? "—"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-sm">
                            {variant ? formatPrice(Number(variant.price)) : "—"}
                          </p>
                          <span
                            className={`inline-block mt-1 text-[10px] uppercase font-display tracking-wider px-2 py-0.5 rounded ${
                              p.is_active
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {p.is_active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
            </div>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({
  label,
  value,
  loading,
  accent = false,
}: {
  label: string;
  value: number;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`bg-card border border-border rounded-lg p-6 relative overflow-hidden ${
        accent ? "border-l-4 border-l-primary" : ""
      }`}
    >
      <p className="text-[11px] font-display tracking-[0.2em] uppercase text-muted-foreground">
        {label}
      </p>
      {loading ? (
        <Skeleton className="h-10 w-20 mt-2" />
      ) : (
        <p className="text-4xl md:text-5xl font-display mt-2">{value}</p>
      )}
    </div>
  );
}
