"use client";

import { useEffect, useRef, useState } from "react";
import { useSync } from "@/app/components/SyncProvider";
import type { MonthStats } from "@/lib/balance";
import { AlertIcon } from "@/app/components/Icons";

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const XOF = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });

// Parité fixe garantie par le Trésor français (UEMOA) : 1 € = 655,957 FCFA.
const EUR_TO_XOF = 655.957;

const VISIBLE_STORAGE_KEY = "sumeria-solde-visible";

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 ${spinning ? "animate-spin" : ""}`}>
      <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a13.15 13.15 0 0 1-3.17 3.86M6.61 6.61C3.94 8.36 2 11 2 11s4 7 11 7a9.29 9.29 0 0 0 4.39-1.06" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Fait défiler `value` depuis sa précédente valeur affichée (pas au premier rendu). */
function useAnimatedNumber(value: number, durationMs = 700): number {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    const from = displayRef.current;
    const to = value;
    if (from === to) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      displayRef.current = to;
      setDisplay(to);
      return;
    }

    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out
      const next = from + (to - from) * eased;
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs]);

  return display;
}

export default function BalanceCard({
  soldeEur,
  configured,
  stats,
}: {
  soldeEur: number;
  configured: boolean;
  stats: MonthStats;
}) {
  const { sync, loading, message, isError } = useSync();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(VISIBLE_STORAGE_KEY) === "1") setHidden(false);
    } catch {
      // localStorage indisponible → on reste masqué
    }
  }, []);

  function toggleHidden() {
    setHidden((prev) => {
      try {
        window.localStorage.setItem(VISIBLE_STORAGE_KEY, prev ? "1" : "0");
      } catch {
        // ignoré
      }
      return !prev;
    });
  }

  const mask = (s: string) => (hidden ? "••••" : s);
  const delta = stats.prevDebits > 0 ? ((stats.debits - stats.prevDebits) / stats.prevDebits) * 100 : null;
  const animatedSolde = useAnimatedNumber(soldeEur);

  return (
    <section className="noise relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-700 to-brand-900 p-6 text-white shadow-xl shadow-brand-900/30">
      {/* « S » en filigrane, comme sur la carte */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -right-4 select-none font-display text-[260px] leading-none text-white/[0.07]"
      >
        S
      </span>

      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-white/80">Solde actuel</p>
            <button
              onClick={toggleHidden}
              aria-label={hidden ? "Afficher le solde" : "Masquer le solde"}
              className="rounded-full p-1.5 text-white/80 transition hover:bg-white/10 active:scale-95"
            >
              <EyeIcon off={hidden} />
            </button>
          </div>
          <button
            onClick={sync}
            disabled={loading}
            aria-label="Synchroniser maintenant"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur transition hover:bg-white/25 active:scale-95 disabled:opacity-60"
          >
            <RefreshIcon spinning={loading} />
          </button>
        </div>

        <p className="mt-2 font-display text-[44px] leading-none tracking-tight">{mask(EUR.format(animatedSolde))}</p>
        <p className="mt-2 text-sm text-white/75">≈ {mask(XOF.format(animatedSolde * EUR_TO_XOF))}</p>

        <div className="mt-5 flex gap-2 text-xs">
          <span className="rounded-full bg-white/15 px-3 py-1.5">Ce mois : +{mask(EUR.format(stats.credits))}</span>
          <span className="rounded-full bg-white/15 px-3 py-1.5">−{mask(EUR.format(stats.debits))}</span>
          {delta !== null && !hidden && (
            <span className="rounded-full bg-white/15 px-3 py-1.5" title="Dépenses vs mois dernier">
              {delta >= 0 ? "▲" : "▼"} {Math.abs(Math.round(delta))}%
            </span>
          )}
        </div>

        {!configured && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs">
            <AlertIcon className="h-4 w-4 shrink-0" />
            <span>Solde initial non configuré — lance <code>npm run balance:set</code> (voir README).</span>
          </p>
        )}

        {message && (
          <p className={`mt-3 rounded-xl px-3 py-2 text-xs ${isError ? "bg-red-900/50 text-red-100" : "bg-white/15"}`}>{message}</p>
        )}
      </div>
    </section>
  );
}
