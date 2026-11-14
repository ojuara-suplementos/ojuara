import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigationType, useSearchParams } from "react-router-dom";

import { useProducts, useCategories, useBrands } from "@/hooks/useProducts";
import { ProductCard } from "@/components/ProductCard";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlidersHorizontal, X, PackageX } from "lucide-react";
import {
  minVariantPrice,
  formatPrice,
  isOfferProduct,
  isKitProduct,
} from "@/lib/format";
import {
  normalizeText,
  productMatchesQuery,
  matchCategoryByQuery,
} from "@/lib/search";
import type { Product } from "@/types/catalog";

type SortKey = "relevance" | "price-asc" | "price-desc" | "az" | "za";

const PER_PAGE = 10;
const DESKTOP_PER_PAGE = 12;

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  whey: "Proteínas de alta concentração e rápida absorção, ideais para acelerar a recuperação muscular pós-treino e potencializar seus ganhos de massa magra.",
  creatina:
    "Suplementos focados em força explosiva, volumização celular e desempenho em treinos de alta intensidade. Indicados para quem busca performance máxima.",
  "pre-treino":
    "Fórmulas estimulantes que elevam foco, energia e disposição. Pensadas para quem precisa de um empurrão extra antes de cada série.",
  hipercalorico:
    "Combinações ricas em carboidratos e proteínas para suporte calórico, ideais para quem tem dificuldade de ganhar peso e busca volume muscular.",
  emagrecedores:
    "Termogênicos e auxiliares no controle de apetite, formulados para acelerar o metabolismo e apoiar processos de definição corporal.",
  vitaminas:
    "Micronutrientes essenciais para o equilíbrio do organismo, imunidade e rendimento diário — base de qualquer rotina saudável.",
  acessorios:
    "Itens complementares para potencializar sua experiência de treino: coqueteleiras, doseadores e equipamentos do dia a dia.",
};

const normalizeSearchValue = normalizeText;

const splitParam = (value: string | null) =>
  (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const LISTING_SCROLL_KEY = "ojuara:listing-scroll";
const SORT_KEYS: SortKey[] = [
  "relevance",
  "price-asc",
  "price-desc",
  "az",
  "za",
];

const ProductList = () => {
  const [params, setParams] = useSearchParams();
  const navigationType = useNavigationType();
  const categoryParam = params.get("categoria");
  const brandParam = params.get("marca");
  const flavorParam = params.get("sabor");
  const priceParam = params.get("preco");
  const qRaw = params.get("q") ?? "";
  const q = normalizeSearchValue(qRaw);
  const typeRaw = params.get("tipo");
  const typeParam: "offer" | "kit" | null =
    typeRaw === "kit"
      ? "kit"
      : typeRaw === "offer" || typeRaw === "oferta"
        ? "offer"
        : null;

  const sortParam = params.get("sort") as SortKey | null;
  const sort: SortKey =
    sortParam && SORT_KEYS.includes(sortParam) ? sortParam : "relevance";
  const pageParam = Number(params.get("page"));
  const page =
    Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const {
    data: products = [],
    isLoading: isProductsLoading,
    isFetching: isProductsFetching,
    isError: isProductsError,
    refetch: refetchProducts,
  } = useProducts();
  const { data: categories = [], isLoading: isCategoriesLoading } =
    useCategories();
  const { data: brands = [], isLoading: isBrandsLoading } = useBrands();

  const selectedCats = useMemo(
    () => splitParam(categoryParam),
    [categoryParam],
  );
  const selectedBrands = useMemo(() => splitParam(brandParam), [brandParam]);
  const selectedFlavors = useMemo(() => splitParam(flavorParam), [flavorParam]);
  const priceRange = useMemo<[number, number] | null>(() => {
    if (!priceParam) return null;
    const [a, b] = priceParam.split("-").map((v) => Number(v));
    if (Number.isFinite(a) && Number.isFinite(b)) return [a, b];
    return null;
  }, [priceParam]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Itens por página conforme o breakpoint: desktop (4 colunas) = 12, tablet/mobile = 10
  const [perPage, setPerPage] = useState<number>(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 1280px)").matches
      ? DESKTOP_PER_PAGE
      : PER_PAGE,
  );
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1280px)");
    const apply = () => setPerPage(mql.matches ? DESKTOP_PER_PAGE : PER_PAGE);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  const isInitialCatalogLoading =
    isProductsLoading || isCategoriesLoading || isBrandsLoading;
  const hasAnyCatalogData =
    products.length > 0 || categories.length > 0 || brands.length > 0;
  const showCatalogSkeleton = isInitialCatalogLoading && !hasAnyCatalogData;
  const showRefreshIndicator = isProductsFetching && !showCatalogSkeleton;

  const setPage = (updater: number | ((current: number) => number)) => {
    const next = typeof updater === "function" ? updater(page) : updater;
    updateParam("page", next > 1 ? String(next) : null);
  };

  // replace = true apenas para correções automáticas da URL (clamp de página, reset interno).
  // Ações do usuário empilham histórico normalmente para permitir "Voltar".
  const updateParam = (key: string, value: string | null, replace = false) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (next.toString() === params.toString()) return;
    setParams(next, { replace });
  };

  const clearAllFilters = () => {
    const next = new URLSearchParams(params);
    ["categoria", "marca", "sabor", "preco", "page"].forEach((k) =>
      next.delete(k),
    );
    if (next.toString() === params.toString()) return;
    setParams(next, { replace: false });
  };

  // Restauração apenas da posição de scroll — filtros vêm exclusivamente da URL
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const savedScroll = Number(sessionStorage.getItem(LISTING_SCROLL_KEY));
    if (
      navigationType === "POP" &&
      Number.isFinite(savedScroll) &&
      savedScroll > 0
    ) {
      requestAnimationFrame(() =>
        window.scrollTo({ top: savedScroll, behavior: "auto" }),
      );
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [navigationType]);

  // Salva a posição continuamente para restaurar ao voltar de um produto
  useEffect(() => {
    const save = () =>
      sessionStorage.setItem(LISTING_SCROLL_KEY, String(window.scrollY));
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      save();
      window.removeEventListener("scroll", save);
    };
  }, []);

  // Rolagem suave ao topo quando filtros, busca, ordenação ou página mudam
  const scrollSignature = `${categoryParam}|${brandParam}|${flavorParam}|${priceParam}|${q}|${typeParam}|${sort}|${page}`;
  const lastSignature = useRef<string | null>(null);
  useEffect(() => {
    if (lastSignature.current === null) {
      lastSignature.current = scrollSignature;
      return;
    }
    if (lastSignature.current === scrollSignature) return;
    lastSignature.current = scrollSignature;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [scrollSignature]);

  // Reset pagination whenever filters or search change
  const filterSignature = `${categoryParam}|${brandParam}|${flavorParam}|${priceParam}|${q}|${typeParam}`;
  const lastFilterSignature = useRef<string | null>(null);
  useEffect(() => {
    if (lastFilterSignature.current === null) {
      lastFilterSignature.current = filterSignature;
      return;
    }
    if (lastFilterSignature.current === filterSignature) return;
    lastFilterSignature.current = filterSignature;
    // Ao voltar/avançar no histórico a URL já é a desejada: não reescrever a entrada.
    if (navigationType === "POP") return;
    updateParam("page", null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSignature, navigationType]);

  const priceBounds = useMemo<[number, number]>(() => {
    if (!products.length) return [0, 1000];
    const prices = products
      .map((p) => minVariantPrice(p.product_variants))
      .filter((v) => v > 0);
    if (!prices.length) return [0, 1000];
    const min = Math.floor(Math.min(...prices));
    const max = Math.ceil(Math.max(...prices));
    return [min, max === min ? min + 1 : max];
  }, [products]);

  const effectivePriceRange = priceRange ?? priceBounds;

  useEffect(() => {
    if (filtersOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [filtersOpen]);

  const activeCategory = useMemo(() => {
    const slug = selectedCats[0];
    if (!slug) return null;
    return categories.find((c) => c.slug === slug) ?? null;
  }, [categories, selectedCats]);

  // Descrição só aparece quando a busca corresponde explicitamente ao nome de uma categoria
  const queryMatchedCategory = useMemo(
    () => (q ? matchCategoryByQuery(q, categories) : null),
    [q, categories],
  );

  const descriptionCategory = activeCategory ?? queryMatchedCategory;
  const categoryDescription = descriptionCategory
    ? descriptionCategory.description?.trim() ||
      CATEGORY_DESCRIPTIONS[descriptionCategory.slug] ||
      `Confira nossa seleção de produtos da categoria ${descriptionCategory.name}, escolhidos para entregar máxima qualidade e resultado real.`
    : null;

  const pageTitle =
    typeParam === "offer"
      ? "Ofertas"
      : typeParam === "kit"
        ? "Kits"
        : (activeCategory?.name ?? "Produtos");

  // const allFlavors = useMemo(() => {
  //   const set = new Set<string>();
  //   products.forEach((p) => p.product_variants.forEach((v) => v.flavor && set.add(v.flavor)));
  //   return Array.from(set).sort();
  // }, [products]);

  const allFlavors = useMemo(() => {
    const set = new Set<string>();

    products.forEach((p) =>
      p.product_variants.forEach((v) => {
        if (v.flavor) {
          v.flavor.split(",").forEach((flavor) => {
            const trimmed = flavor.trim();
            if (trimmed) set.add(trimmed);
          });
        }
      }),
    );

    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    let list = products.slice();
    if (typeParam === "offer") {
      // Marcado como oferta no painel ou com variante em promoção
      list = list.filter(isOfferProduct);
    } else if (typeParam === "kit") {
      list = list.filter(isKitProduct);
    }
    if (q) list = list.filter((p) => productMatchesQuery(p, q));
    if (selectedCats.length)
      list = list.filter(
        (p) => p.categories && selectedCats.includes(p.categories.slug),
      );
    if (selectedBrands.length)
      list = list.filter(
        (p) => p.brand_id && selectedBrands.includes(p.brand_id),
      );
    // if (selectedFlavors.length)
    //   list = list.filter((p) =>
    //     p.product_variants.some(
    //       (v) => v.flavor && selectedFlavors.includes(v.flavor),
    //     ),
    //   );
    if (selectedFlavors.length)
      list = list.filter((p) =>
        p.product_variants.some((v) =>
          v.flavor
            ?.split(",")
            .map((flavor) => flavor.trim())
            .some((flavor) => selectedFlavors.includes(flavor)),
        ),
      );
    if (priceRange) {
      const [min, max] = priceRange;
      list = list.filter((p) => {
        const price = minVariantPrice(p.product_variants);
        return price >= min && price <= max;
      });
    }

    switch (sort) {
      case "price-asc":
        list.sort(
          (a, b) =>
            minVariantPrice(a.product_variants) -
            minVariantPrice(b.product_variants),
        );
        break;
      case "price-desc":
        list.sort(
          (a, b) =>
            minVariantPrice(b.product_variants) -
            minVariantPrice(a.product_variants),
        );
        break;
      case "az":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "za":
        list.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }
    return list;
  }, [
    products,
    q,
    typeParam,
    selectedCats,
    selectedBrands,
    selectedFlavors,
    priceRange,
    sort,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  // Mantém a URL coerente com a página realmente exibida (ex.: ?page=99)
  useEffect(() => {
    // Só corrige a URL depois que os produtos realmente carregaram,
    // senão um deep link para ?page=2 seria zerado durante o carregamento.
    if (showCatalogSkeleton || isProductsLoading || isProductsFetching) return;
    if (page === safePage) return;
    updateParam("page", safePage > 1 ? String(safePage) : null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    safePage,
    showCatalogSkeleton,
    isProductsLoading,
    isProductsFetching,
  ]);

  const toggleInParam = (key: string, current: string[], val: string) => {
    const nextValues = current.includes(val)
      ? current.filter((x) => x !== val)
      : [...current, val];
    if (key === "categoria") {
      // Nova categoria limpa a busca textual e filtros incompatíveis
      const next = new URLSearchParams(params);
      if (nextValues.length) next.set("categoria", nextValues.join(","));
      else next.delete("categoria");
      ["q", "sabor", "page"].forEach((k) => next.delete(k));
      if (next.toString() === params.toString()) return;
      setParams(next, { replace: false });
      return;
    }
    updateParam(key, nextValues.length ? nextValues.join(",") : null);
  };

  useEscapeKey(filtersOpen, () => setFiltersOpen(false));

  const FiltersContent = (
    <div className="space-y-6">
      <FilterGroup title="Categoria">
        {categories.map((c) => (
          <label
            key={c.id}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <Checkbox
              aria-label={c.name}
              checked={selectedCats.includes(c.slug)}
              onCheckedChange={() =>
                toggleInParam("categoria", selectedCats, c.slug)
              }
            />
            {c.name}
          </label>
        ))}
      </FilterGroup>
      <FilterGroup title="Marca">
        {brands.map((b) => (
          <label
            key={b.id}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <Checkbox
              aria-label={b.name}
              checked={selectedBrands.includes(b.id)}
              onCheckedChange={() =>
                toggleInParam("marca", selectedBrands, b.id)
              }
            />
            {b.name}
          </label>
        ))}
      </FilterGroup>
      {allFlavors.length > 0 && (
        <FilterGroup title="Sabor / Cor">
          {allFlavors.map((f) => (
            <label
              key={f}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <Checkbox
                aria-label={f}
                checked={selectedFlavors.includes(f)}
                onCheckedChange={() =>
                  toggleInParam("sabor", selectedFlavors, f)
                }
              />
              {f}
            </label>
          ))}
        </FilterGroup>
      )}
      <FilterGroup title="Preço">
        <PriceSlider
          bounds={priceBounds}
          value={effectivePriceRange}
          onCommit={(range) => {
            const isFullRange =
              range[0] === priceBounds[0] && range[1] === priceBounds[1];
            updateParam(
              "preco",
              isFullRange ? null : `${range[0]}-${range[1]}`,
            );
          }}
        />
      </FilterGroup>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6 md:py-10">
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-wide">
          {pageTitle}
        </h1>
        {q && (
          <p className="text-sm text-muted-foreground mt-2">
            Resultados para{" "}
            <span className="text-foreground font-semibold">"{qRaw}"</span>
          </p>
        )}
        {categoryDescription && (
          <div className="mt-4 max-w-3xl border-l-2 border-primary pl-4">
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              {categoryDescription}
            </p>
          </div>
        )}
        {!categoryDescription && !q && typeParam === "offer" && (
          <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-3xl">
            Promoções selecionadas com descontos especiais por tempo limitado.
            Aproveite enquanto durar.
          </p>
        )}
        {!categoryDescription && !q && typeParam === "kit" && (
          <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-3xl">
            Combos pensados para potencializar seus resultados — sinergia de
            produtos com preço de conjunto.
          </p>
        )}
        {!categoryDescription && !q && !typeParam && (
          <p className="text-sm text-muted-foreground mt-1">
            Confira nossa linha completa de suplementos premium para todos os
            objetivos.
          </p>
        )}
      </div>

      {/* Toolbar */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:flex md:items-center">
        <div className="min-w-0 md:ml-auto md:flex md:items-center md:gap-3 md:order-2">
          <Label
            htmlFor="sort"
            className="text-sm text-muted-foreground hidden md:inline"
          >
            Ordenar:
          </Label>
          <Select
            value={sort}
            onValueChange={(v) =>
              updateParam("sort", v === "relevance" ? null : v)
            }
          >
            <SelectTrigger id="sort" className="h-10 w-full md:w-auto min-w-0">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Mais recentes</SelectItem>
              <SelectItem value="price-asc">Menor preço</SelectItem>
              <SelectItem value="price-desc">Maior preço</SelectItem>
              <SelectItem value="az">A-Z</SelectItem>
              <SelectItem value="za">Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          className="md:hidden gap-2 h-10 w-full"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal className="w-4 h-4" /> Filtrar
        </Button>
      </div>

      {/* Active filters */}
      {(selectedCats.length > 0 ||
        selectedBrands.length > 0 ||
        selectedFlavors.length > 0 ||
        priceRange) && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">
            Filtros ativos:
          </span>
          {selectedCats.map((slug) => {
            const cat = categories.find((c) => c.slug === slug);
            return (
              <ActiveFilterChip
                key={`cat-${slug}`}
                label={cat?.name ?? slug}
                onRemove={() => toggleInParam("categoria", selectedCats, slug)}
              />
            );
          })}
          {selectedBrands.map((id) => {
            const brand = brands.find((b) => b.id === id);
            return (
              <ActiveFilterChip
                key={`brand-${id}`}
                label={brand?.name ?? "Marca"}
                onRemove={() => toggleInParam("marca", selectedBrands, id)}
              />
            );
          })}
          {selectedFlavors.map((f) => (
            <ActiveFilterChip
              key={`flv-${f}`}
              label={f}
              onRemove={() => toggleInParam("sabor", selectedFlavors, f)}
            />
          ))}
          {priceRange && (
            <ActiveFilterChip
              label={`${formatPrice(priceRange[0])} - ${formatPrice(priceRange[1])}`}
              onRemove={() => updateParam("preco", null)}
            />
          )}
          <button
            onClick={() => clearAllFilters()}
            className="hidden md:inline text-xs font-semibold text-primary hover:underline ml-1"
          >
            Limpar tudo
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-[240px_1fr] gap-6">
        {/* Desktop filters */}
        <aside className="hidden md:block bg-card p-5 rounded-xl border border-border h-fit self-start sticky top-20 md:max-h-[calc(100dvh-6rem)] md:overflow-y-auto md:overscroll-contain">
          <h3 className="font-bold mb-4">Filtros</h3>
          {showCatalogSkeleton ? <FiltersSkeleton /> : FiltersContent}
        </aside>

        {/* Products grid */}
        <div className="relative min-h-[420px]">
          {isProductsError && products.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center gap-3">
              <PackageX className="w-16 h-16 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                Não foi possível carregar os produtos.
              </p>
              <Button variant="outline" onClick={() => refetchProducts()}>
                Tentar novamente
              </Button>
            </div>
          ) : showCatalogSkeleton ? (
            <ProductGridSkeleton count={8} />
          ) : paged.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center gap-3">
              <PackageX className="w-16 h-16 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                Nenhum produto encontrado.
              </p>
            </div>
          ) : (
            <>
              <div
                key={`page-${safePage}`}
                className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 animate-soft-in"
              >
                {paged.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    offerOnly={typeParam === "offer"}
                  />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage === 1}
                    onClick={() => setPage(safePage - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground px-3">
                    Página {safePage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage === totalPages}
                    onClick={() => setPage(safePage + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 animate-fade-in"
            onClick={() => setFiltersOpen(false)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Filtros de produtos"
            className="absolute right-0 top-0 h-full w-[min(75vw,18rem)] bg-background shadow-2xl animate-slide-in-right flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border bg-secondary text-secondary-foreground">
              <span className="font-bold">Filtros</span>
              <button
                onClick={() => setFiltersOpen(false)}
                aria-label="Fechar filtros"
                className="p-1 hover:text-primary"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {showCatalogSkeleton ? <FiltersSkeleton /> : FiltersContent}
            </div>
            <div className="border-t border-border p-4 flex gap-2">
              <Button
                variant="outline"
                onClick={clearAllFilters}
                className="flex-1 gap-2"
              >
                <X className="w-4 h-4" /> Limpar filtros
              </Button>
              <Button onClick={() => setFiltersOpen(false)} className="flex-1">
                Aplicar
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
function ActiveFilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <Badge
      variant="secondary"
      className="gap-1 pl-2 pr-1 py-1 text-xs font-semibold normal-case"
    >
      {label}
      <button
        onClick={onRemove}
        aria-label={`Remover filtro ${label}`}
        className="ml-0.5 rounded-sm hover:bg-background/60 p-0.5"
      >
        <X className="w-3 h-3" />
      </button>
    </Badge>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="font-bold text-sm mb-2">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2">
            {Array.from({ length: index === 3 ? 2 : 3 }).map(
              (__, itemIndex) => (
                <div key={itemIndex} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4 rounded-sm" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PriceSlider({
  bounds,
  value,
  onCommit,
}: {
  bounds: [number, number];
  value: [number, number];
  onCommit: (range: [number, number]) => void;
}) {
  const [local, setLocal] = useState<[number, number]>(value);
  useEffect(() => {
    setLocal(value);
  }, [value[0], value[1]]);
  return (
    <div className="space-y-3 pt-1">
      <Slider
        min={bounds[0]}
        max={bounds[1]}
        step={1}
        value={local}
        onValueChange={(v) => setLocal([v[0], v[1]])}
        onValueCommit={(v) => onCommit([v[0], v[1]])}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatPrice(local[0])}</span>
        <span>{formatPrice(local[1])}</span>
      </div>
    </div>
  );
}

export default ProductList;
