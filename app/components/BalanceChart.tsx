"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SeriesPoint } from "@/lib/charts";

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const EUR_FULL = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

const PAD = { top: 12, right: 12, bottom: 22, left: 8 };
const HEIGHT = 160;

/** Graduations "rondes" (3 lignes) couvrant [min, max]. */
function niceTicks(min: number, max: number): number[] {
  const range = max - min || 10;
  const raw = range / 3;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step; v += step) ticks.push(v);
  return ticks;
}

export default function BalanceChart({ daily, monthly }: { daily: SeriesPoint[]; monthly: SeriesPoint[] }) {
  const [range, setRange] = useState<"30j" | "6m">("30j");
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = range === "30j" ? daily : monthly;

  const geo = useMemo(() => {
    const values = points.map((p) => p.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding = (rawMax - rawMin || Math.abs(rawMax) || 10) * 0.15;
    const ticks = niceTicks(rawMin - padding, rawMax + padding);
    const min = ticks[0];
    const max = ticks[ticks.length - 1];
    const plotW = width - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
    const y = (v: number) => PAD.top + plotH - ((v - min) / (max - min || 1)) * plotH;
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
    const baselineY = y(min);
    const area = `${path} L${x(points.length - 1).toFixed(1)},${baselineY} L${x(0).toFixed(1)},${baselineY} Z`;
    return { ticks, x, y, path, area, plotW, plotH };
  }, [points, width]);

  const last = points[points.length - 1];
  const first = points[0];
  const delta = last && first ? last.value - first.value : 0;
  const active = hover !== null ? points[hover] : null;

  function onPointer(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - PAD.left;
    const idx = Math.round((px / geo.plotW) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, idx)));
  }

  // Étiquettes de l'axe X : première, milieu, dernière
  const xLabels = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <section className="rounded-2xl bg-white p-4 dark:bg-ink-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Évolution du solde</h2>
          <p className="mt-0.5 text-xs text-ink-900/50 dark:text-white/50">
            {range === "30j" ? "30 derniers jours" : "6 derniers mois"} ·{" "}
            <span className={delta >= 0 ? "text-brand-700 dark:text-brand-200" : "text-red-600 dark:text-red-300"}>
              {delta >= 0 ? "+" : "−"}
              {EUR_FULL.format(Math.abs(delta))}
            </span>
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-ink-900/5 p-0.5 dark:bg-white/10">
          {(["30j", "6m"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRange(r);
                setHover(null);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                range === r ? "bg-white shadow-sm dark:bg-ink-600" : "text-ink-900/60 dark:text-white/60"
              }`}
            >
              {r === "30j" ? "30 j" : "6 mois"}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="relative mt-3 select-none">
        <svg
          width={width}
          height={HEIGHT}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setHover(null)}
          className="block touch-pan-y"
          role="img"
          aria-label={`Solde ${range === "30j" ? "sur 30 jours" : "sur 6 mois"}, actuellement ${EUR_FULL.format(last?.value ?? 0)}`}
        >
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--viz-grid)" strokeWidth={1} />
              <text x={width - PAD.right} y={geo.y(t) - 3} textAnchor="end" fontSize={10} fill="var(--viz-muted)">
                {EUR.format(t)}
              </text>
            </g>
          ))}

          <path d={geo.area} fill="var(--viz-series)" fillOpacity={0.1} />
          <path d={geo.path} fill="none" stroke="var(--viz-series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {xLabels.map((i) => (
            <text
              key={i}
              x={geo.x(i)}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              fontSize={10}
              fill="var(--viz-muted)"
            >
              {points[i].label}
            </text>
          ))}

          {active && hover !== null && (
            <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--viz-muted)" strokeWidth={1} />
          )}

          {last && (
            <circle
              cx={geo.x(hover ?? points.length - 1)}
              cy={geo.y((active ?? last).value)}
              r={4}
              fill="var(--viz-series)"
              stroke="var(--viz-surface)"
              strokeWidth={2}
            />
          )}
        </svg>

        {active && hover !== null && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs text-white shadow-lg dark:bg-white dark:text-ink-900"
            style={{ left: Math.min(Math.max(geo.x(hover) - 50, 0), width - 110) }}
          >
            <div className="text-[10px] opacity-70">{active.label}</div>
            <div className="font-semibold">{EUR_FULL.format(active.value)}</div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowTable((v) => !v)}
        className="mt-2 text-xs text-ink-900/50 underline-offset-2 hover:underline dark:text-white/50"
      >
        {showTable ? "Masquer les valeurs" : "Voir les valeurs"}
      </button>
      {showTable && (
        <table className="mt-2 w-full text-xs">
          <tbody>
            {points.map((p) => (
              <tr key={p.date} className="border-t border-ink-900/5 dark:border-white/5">
                <td className="py-1 text-ink-900/60 dark:text-white/60">{p.label}</td>
                <td className="py-1 text-right tabular-nums">{EUR_FULL.format(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
