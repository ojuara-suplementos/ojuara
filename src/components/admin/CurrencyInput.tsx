import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCurrencyInput, parseCurrencyDigits } from "@/lib/normalize";

interface Props {
  value: number | null | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  invalid?: boolean;
  id?: string;
}

export function CurrencyInput({ value, onChange, placeholder = "0,00", invalid, id }: Props) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        R$
      </span>
      <Input
        id={id}
        inputMode="numeric"
        className={cn("pl-9", invalid && "border-destructive focus-visible:ring-destructive")}
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        value={formatCurrencyInput(value)}
        onChange={(e) => onChange(parseCurrencyDigits(e.target.value))}
      />
    </div>
  );
}
