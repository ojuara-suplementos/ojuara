import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useCategories, useBrands, useProducts } from "@/hooks/useProducts";
import { isKitProduct } from "@/lib/format";
import { useEffect } from "react";
import { useEscapeKey } from "@/hooks/useEscapeKey";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SideMenu({ open, onClose }: Props) {
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const { data: products = [] } = useProducts({ includeOutOfStock: true });
  const hasActiveKit = products.some((product) => product.is_active && isKitProduct(product));

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEscapeKey(open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside role="dialog" aria-modal="true" aria-label="Menu de navegação" className="absolute left-0 top-0 h-full w-[min(75vw,18rem)] md:w-[85%] md:max-w-sm bg-background shadow-2xl animate-slide-in-left flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary text-secondary-foreground">
          <span className="font-bold text-lg">Menu</span>
          <button onClick={onClose} aria-label="Fechar menu" className="p-1 hover:text-primary">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <Section title="Navegação">
            <MenuLink to="/produtos" onClick={onClose}>Todos os produtos</MenuLink>
            <MenuLink to="/produtos?tipo=offer" onClick={onClose}>Ofertas</MenuLink>
            {hasActiveKit && (
              <MenuLink to="/produtos?tipo=kit" onClick={onClose}>Kits</MenuLink>
            )}
          </Section>

          {categories.length > 0 && (
            <Section title="Categorias">
              {categories.map((c) => (
                <MenuLink key={c.id} to={`/produtos?categoria=${c.slug}`} onClick={onClose}>
                  {c.name}
                </MenuLink>
              ))}
            </Section>
          )}

          {brands.length > 0 && (
            <Section title="Marcas">
              {brands.map((b) => (
                <MenuLink key={b.id} to={`/produtos?marca=${b.id}`} onClick={onClose}>
                  {b.name}
                </MenuLink>
              ))}
            </Section>
          )}
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function MenuLink({ to, onClick, children }: { to: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        onClick={onClick}
        className="block py-2 px-3 rounded-md hover:bg-muted hover:text-primary transition-fast font-medium"
      >
        {children}
      </Link>
    </li>
  );
}
