import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Menu, ShoppingCart, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useProducts";
import { useCart } from "@/contexts/CartContext";
import { SideMenu } from "./SideMenu";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

export function Header() {
  const { count, openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const [urlParams] = useSearchParams();
  const urlQ = urlParams.get("q") ?? "";
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Sync header search with URL: clear when leaving search results
  useEffect(() => {
    if (location.pathname.startsWith("/produtos")) {
      setSearch(urlQ);
    } else {
      setSearch("");
    }
  }, [location.pathname, urlQ]);

  const onSearchChange = (value: string) => {
    setSearch(value);
  };

  // Executa a busca apenas em Enter ou clique na lupa.
  // Uma nova busca limpa todos os filtros ativos e a paginação.
  const runSearch = (inputRef?: React.RefObject<HTMLInputElement>) => {
    const term = search.trim();
    navigate(term ? `/produtos?q=${encodeURIComponent(term)}` : "/produtos");
    // mantém o foco no campo de busca após pesquisar
    requestAnimationFrame(() => inputRef?.current?.focus());
  };


  const onSearch = (e: React.FormEvent, inputRef?: React.RefObject<HTMLInputElement>) => {
    e.preventDefault();
    runSearch(inputRef);
  };



  return (
    <>
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center gap-3 xl:gap-8">
          {/* Mobile menu */}
          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden p-2 -ml-2 hover:text-primary transition-fast"
            aria-label="Abrir menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Logo */}
          <Link
            to="/"
            className="flex-1 md:flex-none flex justify-center md:justify-start items-center"
            aria-label="OJUARA - Início"
          >
            <Logo size="md" showText={true} variant="icon" />
          </Link>

          {/* Desktop nav */}
          <DesktopNav onOpenMenu={() => setMenuOpen(true)} />

          {/* Search desktop (lg+) */}
          <form onSubmit={(e) => onSearch(e, desktopInputRef)} className="hidden lg:flex flex-1 max-w-xs ml-auto">
            <div className="relative w-full">
              <button
                type="submit"
                aria-label="Buscar"
                className="absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-primary transition-fast rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              >
                <Search className="w-4 h-4" />
              </button>
              <Input
                ref={desktopInputRef}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                type="search"
                aria-label="Buscar produtos"
                placeholder="BUSCAR..."
                className="pl-9 bg-secondary border-border h-10 text-xs uppercase tracking-wider font-semibold placeholder:text-muted-foreground/70"
              />
            </div>
          </form>


          {/* Cart */}
          <button
            onClick={openCart}
            className={cn(
              "relative p-2 hover:text-primary transition-fast",
              "lg:ml-0 ml-auto",
            )}
            aria-label="Abrir carrinho"
          >
            <ShoppingCart className="w-6 h-6" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {count}
              </span>
            )}
          </button>
        </div>

        {/* Search bar fixa abaixo do header (tablet e menores) */}
        <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur">
          <form onSubmit={(e) => onSearch(e, mobileInputRef)} className="container mx-auto px-4 py-2">
            <div className="relative w-full">
              <button
                type="submit"
                aria-label="Buscar"
                className="absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-primary transition-fast rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              >
                <Search className="w-4 h-4" />
              </button>
              <Input
                ref={mobileInputRef}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                type="search"
                aria-label="Buscar produtos"
                placeholder="BUSCAR..."
                className="pl-9 bg-secondary border-border h-10 text-xs uppercase tracking-wider font-semibold placeholder:text-muted-foreground/70"
              />
            </div>
          </form>

        </div>
      </header>

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

function DesktopNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const location = useLocation();
  const [params] = useSearchParams();
  const { data: categories = [] } = useCategories();
  const isProductsRoute = location.pathname.startsWith("/produtos");
  const isOffers = isProductsRoute && params.get("tipo") === "offer";
  const normalizeCategory = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const categorySlug = (names: string[], fallback: string) =>
    categories.find((category) => names.includes(normalizeCategory(category.name)) || names.includes(normalizeCategory(category.slug)))?.slug ?? fallback;
  const creatinaSlug = categorySlug(["creatina", "creatinas"], "creatina");
  const wheySlug = categorySlug(["whey-e-proteinas", "whey-proteinas", "whey-protein", "whey", "proteinas"], "whey-e-proteinas");
  const isCategoryActive = (slug: string) => isProductsRoute && !params.get("tipo") && params.get("categoria") === slug;

  const linkClass = (active: boolean) =>
    cn(
      "transition-fast",
      active ? "text-primary underline-accent" : "hover:text-primary",
    );

  return (
    <nav className="hidden md:flex items-center gap-3 xl:gap-7 text-xs lg:text-sm font-bold uppercase tracking-wider whitespace-nowrap">
      <Button variant="ghost" onClick={onOpenMenu} className="h-auto p-0 font-bold uppercase tracking-wider text-inherit hover:bg-transparent hover:text-primary">
        <Menu className="w-4 h-4" /> Categorias
      </Button>
      <NavLink to="/produtos?tipo=offer" className={linkClass(isOffers)}>
        Ofertas
      </NavLink>
      <NavLink to={`/produtos?categoria=${encodeURIComponent(creatinaSlug)}`} className={linkClass(isCategoryActive(creatinaSlug))}>
        Creatina
      </NavLink>
      <NavLink to={`/produtos?categoria=${encodeURIComponent(wheySlug)}`} className={linkClass(isCategoryActive(wheySlug))}>
        Whey e proteínas
      </NavLink>
    </nav>
  );
}
