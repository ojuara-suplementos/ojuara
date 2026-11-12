import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export interface TopViewedItem {
  id: string;
  name: string;
  views: number;
}

/** 980 · 1,2 mil · 15,8 mil · 120 mil */
export function formatViews(value: number): string {
  const n = Number(value) || 0;
  if (n < 1000) return String(n);
  const thousands = n / 1000;
  const decimals = thousands < 100 ? 1 : 0;
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(thousands);
  return `${formatted} mil`;
}

const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

export function TopViewedChart({ data }: { data: TopViewedItem[] }) {
  const isMobile = useIsMobile();
  const items = [...data]
    .filter((d) => d.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  if (!items.length) {
    return (
      <div className="h-full grid place-items-center text-center border border-dashed border-border rounded-md p-6">
        <div className="space-y-3">
          <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/40" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground max-w-[16rem]">
            Ainda não há visualizações suficientes para gerar o ranking dos produtos.
          </p>
        </div>
      </div>
    );
  }

  const max = Math.max(...items.map((d) => d.views));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={items} margin={{ top: 20, right: 8, left: 8, bottom: 4 }} barCategoryGap={isMobile ? "25%" : "18%"}>
        <XAxis
          dataKey="name"
          stroke="hsl(var(--muted-foreground))"
          fontSize={isMobile ? 9 : 11}
          interval={0}
          tickMargin={8}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => truncate(v, isMobile ? 12 : 20)}
        />
        <YAxis hide scale="sqrt" domain={[0, Math.max(1, Math.round(max * 1.15))]} allowDataOverflow={false} />
        <Tooltip
          cursor={false}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const item = payload[0].payload as TopViewedItem;
            return (
              <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
                <p className="text-sm font-medium text-popover-foreground max-w-[15rem] whitespace-normal break-words">
                  {item.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatViews(item.views)} {item.views === 1 ? "visualização" : "visualizações"}
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="views" radius={[6, 6, 0, 0]} isAnimationActive={false} minPointSize={4}>
          <LabelList
            dataKey="views"
            position="top"
            offset={8}
            content={(props: any) => {
              const { x, y, width, value, index } = props;
              const isFirst = index === 0;
              const cx = Number(x) + Number(width) / 2;
              return (
                <g>
                  <text
                    x={cx}
                    y={y}
                    dy={-2}
                    textAnchor="middle"
                    fill="hsl(var(--foreground))"
                    fontSize={isMobile ? 11 : 13}
                    fontWeight={600}
                  >
                    {isFirst ? `🥇 ${formatViews(value as number)}` : formatViews(value as number)}
                  </text>
                </g>
              );
            }}
          />
          {items.map((item, i) => (
            <Cell
              key={item.id}
              fill={i === 0 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.45)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
