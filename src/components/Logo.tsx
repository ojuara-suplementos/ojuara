import logoIcon from "@/assets/logo-ojuara.png";
import logoFull from "@/assets/logo-ojuara-full.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "icon" | "full";
}

const sizeMap = {
  sm: "h-8",
  md: "h-12",
  lg: "h-16",
};

export function Logo({ className, showText = true, size = "md", variant = "icon" }: LogoProps) {
  const src = variant === "full" ? logoFull : logoIcon;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img
        src={src}
        alt="OJUARA"
        className={cn("w-auto object-contain drop-shadow-[0_2px_8px_rgba(232,58,44,0.35)]", sizeMap[size])}
      />
      {showText && (
        <span className="font-display font-bold text-xl md:text-2xl tracking-wide text-primary">
          OJUARA
        </span>
      )}
    </span>
  );
}
