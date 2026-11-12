import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Rola suavemente para o topo em toda navegação.
 * A listagem (/produtos) é ignorada porque gerencia a própria
 * restauração de posição (ver useListingState).
 */
const ScrollToTop = () => {
  const { pathname, search } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (pathname.startsWith("/produtos")) return;
    const behavior: ScrollBehavior = navigationType === "POP" ? "auto" : "smooth";
    window.scrollTo({ top: 0, left: 0, behavior });
  }, [pathname, search, navigationType]);

  return null;
};

export default ScrollToTop;
