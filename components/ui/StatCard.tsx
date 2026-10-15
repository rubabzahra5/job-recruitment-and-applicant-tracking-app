import { TrendingDown, TrendingUp } from "lucide-react";
import { IconTile } from "@/components/ui/IconTile";
import type { LucideIcon } from "lucide-react";

export interface StatCardProps {
  label: string;
  value: string;
  /** 7 data points for the sparkline. */
  spark?: number[];
  /** e.g. +12.5 or -3.2 (percent). */
  trend?: number;
  trendLabel?: string;
  icon?: LucideIcon;
  tone?: "blue" | "teal" | "amber" | "emerald" | "rose" | "slate" | "navy" | "violet" | "indigo";
  hint?: string;
  hero?: boolean;
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const w = 96;
  const h = 28;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(" ");
  const stroke = positive ? "#047857" : "#be123c";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="overflow-visible">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * KPI card: icon tile, big tabular number, trend arrow + %, 7-day sparkline.
 * Hero variant renders larger for the 3–4 top metrics.
 */
export function StatCard({ label, value, spark, trend, trendLabel, icon: Icon, tone = "blue", hint, hero = false }: StatCardProps) {
  const positive = (trend ?? 0) >= 0;
  return (
    <div
      className={`card-lift relative overflow-hidden rounded-2xl border border-slate-200 bg-white ${
        hero ? "p-6" : "p-5"
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-600 to-teal-400"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon && <IconTile icon={Icon} tone={tone} size={hero ? "md" : "sm"} />}
          <p className="text-sm font-medium text-slate-500">{label}</p>
        </div>
        {trend != null && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
              positive ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700"
            }`}
          >
            {positive ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />}
            {positive ? "+" : ""}{trend}%
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className={`${hero ? "text-4xl" : "text-3xl"} font-extrabold tracking-tight text-slate-900 tabular-nums`}>
            {value}
          </p>
          {(trendLabel ?? hint) && (
            <p className="mt-1 text-xs text-slate-500">{trendLabel ?? hint}</p>
          )}
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} positive={positive} />}
      </div>
    </div>
  );
}
