import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = "Página não encontrada | OJUARA";
  }, [location.pathname]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="text-center space-y-4">
        <p className="text-6xl font-black text-primary">404</p>
        <h1 className="text-2xl font-bold">Página não encontrada</h1>
        <p className="text-muted-foreground">
          O endereço acessado não existe ou foi movido.
        </p>
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <Button asChild>
            <Link to="/">Voltar ao início</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/produtos">Ver produtos</Link>
          </Button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
