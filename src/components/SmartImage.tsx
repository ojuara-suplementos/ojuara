import { memo, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  src?: string | null;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  width?: number;
  height?: number;
  /** Imagens acima da dobra (banner) podem carregar imediatamente */
  eager?: boolean;
  fallback?: ReactNode;
}

/**
 * Imagem com lazy loading + fade suave (250ms) ao terminar o carregamento
 * e skeleton shimmer enquanto carrega.
 */
export const SmartImage = memo(function SmartImage({
  src,
  alt,
  className,
  wrapperClassName,
  width,
  height,
  eager = false,
  fallback = null,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <>{fallback}</>;
  }

  return (
    <div className={cn("relative w-full h-full", wrapperClassName)}>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-200 ease-out",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
      />
      {!loaded && <div className="absolute inset-0 skeleton-shimmer" aria-hidden="true" />}
    </div>
  );
});
