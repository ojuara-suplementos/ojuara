import { Link } from "react-router-dom";
import { Truck, ShieldCheck, CreditCard, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProducts, useCategories } from "@/hooks/useProducts";
import { ProductCarousel } from "@/components/ProductCarousel";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { Logo } from "@/components/Logo";
import { Marquee } from "@/components/Marquee";

import logoFull from "@/assets/logo-ojuara-full.png";
import { Reveal } from "@/components/Reveal";
import { isOfferProduct } from "@/lib/format";

const Home = () => {
  const { data: products = [], isLoading, isError, refetch } = useProducts();
  const { data: categories = [] } = useCategories();

  const offers = products.filter(isOfferProduct).slice(0, 12);
  // useProducts já retorna os produtos em created_at decrescente.
  const newest = products.slice(0, 12);

  return (
    <>
      {/* Hero — inspired by OJUARA prototype */}
      <section className="relative overflow-hidden bg-background">
        <div className="container mx-auto px-0 md:px-4">
          <div className="relative grid md:grid-cols-2 gap-6 items-center min-h-[400px] md:min-h-[520px] py-8 md:py-0">
            {/* Mobile background image */}
            <div className="absolute inset-0 md:hidden flex items-center justify-end bg-gradient-to-br from-background via-background to-secondary/30">
              <img
                src={logoFull}
                alt="OJUARA Suplementos"
                className="w-[92%] max-w-[22rem] object-contain object-right opacity-[0.08] -mr-2"
                width={600}
                height={400}
              />
              <div className="absolute inset-0 gradient-overlay" />
            </div>

            {/* Text */}
            <div className="relative z-10 max-w-[19rem] md:max-w-none pl-4 md:px-0 animate-fade-in">
              <span className="inline-block text-primary font-display font-bold text-xs md:text-sm uppercase tracking-[0.2em] mb-4 underline-accent">
                Alta Performance
              </span>
              <h1 className="font-display text-3xl md:text-5xl font-bold leading-[1.10] mb-5">
                ENCONTRE SEU ARSENAL
                <br />
                COM A <span className="text-primary">OJUARA</span>
              </h1>
              <p className="text-base md:text-lg text-muted-foreground mb-7 max-w-md">
                Temos suplementos específicos para cada objetivo. Encontre o que se adequa à sua necessidade e conheça
                os benefícios que ele pode trazer para sua performance e seu estilo de vida.
              </p>
              <Button
                asChild
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-display font-bold uppercase tracking-wider h-12 px-8 rounded-sm transition-fast hover:opacity-90"
              >
                <Link to="/produtos">
                  Ver produtos <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>

            {/* Desktop image */}
            <div className="hidden md:flex relative w-full h-full -mr-4 items-center justify-center bg-gradient-to-br from-secondary/20 via-background to-background">
              <img
                src={logoFull}
                alt="OJUARA Suplementos"
                className="w-full h-full max-w-[80%] max-h-[70%] object-contain object-center drop-shadow-[0_10px_40px_rgba(232,58,44,0.25)]"
                width={1600}
                height={900}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <Reveal>
        <section className="bg-secondary border-y border-border">
          <div className="container mx-auto px-4 py-4 grid grid-cols-3 gap-2 sm:gap-4">
            <Benefit icon={<Truck className="w-4 h-4" />} title="FRETE GRÁTIS" />
            <Benefit icon={<ShieldCheck className="w-4 h-4" />} title="COMPRA SEGURA" />
            <Benefit icon={<CreditCard className="w-4 h-4" />} title="ATÉ 5X SEM JUROS" />
          </div>
        </section>
      </Reveal>

      {/* Free shipping cities ticker */}
      <Marquee className="bg-marquee text-primary-foreground py-2.5 border-b border-border" speed={30}>
        <span className="font-display font-bold text-xs sm:text-sm uppercase tracking-wider px-6">
          Frete grátis para as cidades de Olindina, Nova Soures, Itapicuru, Inhambupe e Crisópolis
        </span>
        <span className="mx-4 text-primary-foreground/60">●</span>
      </Marquee>

      {isError && products.length === 0 ? (
        <div className="container mx-auto px-4 py-16 text-center flex flex-col items-center gap-3">
          <p className="text-muted-foreground">Não foi possível carregar os produtos.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : isLoading ? (
        <div className="container mx-auto px-4 py-10">
          <ProductGridSkeleton count={8} />
        </div>
      ) : (
        <>
          <Reveal>
            <ProductCarousel
              title={
                <>
                  OFERTAS DO <span className="text-primary">DIA</span>
                </>
              }
              subtitle="Tempo limitado. Performance ilimitada."
              products={offers}
              offerOnly
            />
          </Reveal>
          {newest.length > 0 && (
            <Reveal>
              <ProductCarousel
                title="NOVIDADES"
                subtitle="Os mais recentes do catálogo."
                products={newest}
              />
            </Reveal>
          )}
        </>
      )}

      {/* Categories — Arsenal por Objetivo (inspired layout) */}
      {categories.length > 0 && (
        <Reveal>
          <section className="relative overflow-hidden py-10 md:py-14">
            <div className="container mx-auto px-4">
              <div className="rounded-3xl border border-border p-6 md:p-12 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                {/* Left: title + description + logo */}
                <div className="flex flex-col items-start">
                  <h2 className="font-display text-3xl md:text-5xl font-black uppercase leading-[0.95] text-foreground">
                    Supere seus <span className="text-primary">limites</span>
                  </h2>
                  <p className="mt-6 text-muted-foreground max-w-md text-sm md:text-base">
                    Engenharia pura para atletas que não aceitam o mediano. Produtos premiums desenhados para o pico do
                    desempenho humano.
                  </p>
                </div>

                {/* Right: logo above category pills grid */}
                <div className="flex flex-col items-center gap-6 md:gap-8">
                  <img
                    src={logoFull}
                    alt="OJUARA Suplementos"
                    loading="lazy"
                    decoding="async"
                    className="w-44 md:w-56 object-contain drop-shadow-[0_10px_30px_rgba(232,58,44,0.25)]"
                  />

                  <div className="grid grid-cols-2 gap-3 w-full">
                    {categories.map((c, i) => (
                      <Link
                        key={c.id}
                        to={`/produtos?categoria=${c.slug}`}
                        className="group inline-flex items-center justify-between gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-fast font-display font-bold text-xs md:text-sm uppercase tracking-wider px-4 py-3 rounded-full shadow-sm hover:shadow-md"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <span className="truncate">{c.name}</span>
                        <span className="opacity-80 group-hover:rotate-90 transition-transform shrink-0">+</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      )}
    </>
  );
};

function Benefit({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 min-w-0 text-center">
      <span className="text-primary">{icon}</span>
      <p className="font-display font-bold text-[10px] leading-tight sm:text-sm uppercase tracking-wider">{title}</p>
    </div>
  );
}

export default Home;
