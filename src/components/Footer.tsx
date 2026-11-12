import { Instagram, MessageCircle, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { INSTAGRAM_URL, EMAIL, SITE_NAME, WHATSAPP_NUMBER } from "@/config/site";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="bg-secondary border-t border-border mt-10 md:mt-16">
      <div className="container mx-auto px-4 py-8 md:py-10 grid gap-10 md:grid-cols-4 items-start">
        <div className="md:col-span-2">
          <Logo size="lg" />
          <div className="pl-0 md:pl-2 mt-3 text-xs text-muted-foreground space-y-1">
            <p>CNPJ: 32.362.397/0001-58</p>
            <p>RUA SALUSTIANO GUERRA Nº 56, CENTRO - OLINDINA / BA</p>
          </div>
          <p className="pl-0 md:pl-2 text-sm text-muted-foreground mt-3 max-w-sm">
            Nossa missão é fornecer o combustível de elite para atletas que buscam quebrar seus próprios limites todos
            os dias.
          </p>
          <div className="pl-0 md:pl-2 flex items-center gap-3 mt-5">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="w-9 h-9 flex items-center justify-center rounded-sm bg-background hover:bg-primary hover:text-primary-foreground transition-fast border border-border"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="w-9 h-9 flex items-center justify-center rounded-sm bg-background hover:bg-primary hover:text-primary-foreground transition-fast border border-border"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
            <a
              href={`mailto:${EMAIL}`}
              aria-label="Email"
              className="w-9 h-9 flex items-center justify-center rounded-sm bg-background hover:bg-primary hover:text-primary-foreground transition-fast border border-border"
            >
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="md:pt-6">
          <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-4 text-primary">Navegação</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-fast">
                Home
              </Link>
            </li>
            <li>
              <Link to="/produtos" className="text-muted-foreground hover:text-foreground transition-fast">
                Catálogo
              </Link>
            </li>
            <li>
              <Link to="/produtos?tipo=offer" className="text-muted-foreground hover:text-foreground transition-fast">
                Ofertas
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:pt-6">
          <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-4 text-primary">Vantagens</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <span className="text-muted-foreground">Receba em casa</span>
            </li>
            <li>
              <span className="text-muted-foreground">Compra segura</span>
            </li>
            <li>
              <span className="text-muted-foreground">Até 5x sem juros</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-2 flex flex-col md:flex-row items-center justify-center gap-2 border-t border-border py-5 text-center text-xs uppercase tracking-wider text-muted-foreground">
        <p>
          © {new Date().getFullYear()} {SITE_NAME} — Todos os direitos reservados
        </p>
        <p className="hidden md:block">|</p>
        <p>
          Desenvolvido por{" "}
          <a
            href="https://nalanda.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 transition-fast"
          >
            Nalanda Santos
          </a>
        </p>
      </div>
    </footer>
  );
}
