import { cn } from "@/lib/utils";

/** Bağımlılıksız, hafif çubuk grafik */
export function BarChart({
  data,
  format = (n) => String(n),
  height = 160,
  highlightLast = true,
}: {
  data: { label: string; value: number; sub?: string }[];
  format?: (n: number) => string;
  height?: number;
  highlightLast?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height: height + 36 }}>
      {data.map((d, i) => {
        const h = Math.max(3, (d.value / max) * height);
        const hl = highlightLast && i === data.length - 1;
        return (
          <div key={i} className="group relative flex flex-1 flex-col items-center justify-end gap-2" style={{ height: height + 36 }}>
            <span className="pointer-events-none absolute -top-1 z-10 whitespace-nowrap rounded-md bg-night-700 px-2 py-1 text-[11px] font-semibold opacity-0 shadow transition group-hover:opacity-100">
              {format(d.value)}
              {d.sub && <span className="ml-1 text-smoke-400">{d.sub}</span>}
            </span>
            <div
              className={cn(
                "w-full max-w-[42px] rounded-t-lg transition-all duration-500",
                hl ? "bg-gold-sheen shadow-glow" : "bg-gold-400/25 group-hover:bg-gold-400/45",
              )}
              style={{ height: h }}
            />
            <span className="h-4 truncate text-[10px] text-smoke-500">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Yatay oran çubukları (en çok satanlar, kategoriler) */
export function RankBars({
  rows,
  format,
}: {
  rows: { label: string; value: number; extra?: string }[];
  format: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.label + i}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate text-smoke-200">{r.label}</span>
            <span className="shrink-0 font-semibold text-gold-100">
              {format(r.value)}
              {r.extra && <span className="ml-2 font-normal text-smoke-500">{r.extra}</span>}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-300" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "gold",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "gold" | "ember" | "emerald" | "wine";
}) {
  const tones = {
    gold: "bg-gold-400/10 text-gold-200",
    ember: "bg-ember-500/15 text-ember-300",
    emerald: "bg-emerald-500/10 text-emerald-300",
    wine: "bg-wine-500/15 text-wine-400",
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-smoke-400">{label}</p>
        {icon && <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tones[tone])}>{icon}</span>}
      </div>
      <p className="mt-3 font-display text-4xl font-semibold leading-none text-smoke-50">{value}</p>
      {hint && <p className="mt-2 text-xs text-smoke-500">{hint}</p>}
    </div>
  );
}
