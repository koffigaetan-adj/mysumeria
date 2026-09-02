"use client";

import { useEffect, useRef, useState } from "react";
import { useSync } from "@/app/components/SyncProvider";

const THRESHOLD = 72; // px à tirer pour déclencher
const MAX_PULL = 110;

/** Tirer vers le bas en haut de page (mobile) → synchronisation Gmail. */
export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const { sync, loading } = useSync();
  const [pull, setPull] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    function onStart(e: TouchEvent) {
      // Pas de "tirer pour rafraîchir" si le geste commence dans une liste déjà défilée
      const region = (e.target as Element | null)?.closest<HTMLElement>("[data-scroll-region]");
      const insideScrolledRegion = region ? region.scrollTop > 0 : false;
      startY.current = window.scrollY <= 0 && !insideScrolledRegion ? e.touches[0].clientY : null;
    }
    function onMove(e: TouchEvent) {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      // résistance progressive pour un rendu naturel
      setPull(dy > 0 ? Math.min(MAX_PULL, dy * 0.5) : 0);
    }
    function onEnd() {
      if (startY.current !== null && pull >= THRESHOLD) sync();
      startY.current = null;
      setPull(0);
    }
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [pull, sync]);

  const armed = pull >= THRESHOLD;

  return (
    <div style={{ transform: `translateY(${pull}px)`, transition: pull === 0 ? "transform 200ms" : undefined }}>
      <div
        className="pointer-events-none absolute left-0 right-0 flex justify-center text-xs text-brand-700 dark:text-brand-200"
        style={{ top: -28, opacity: Math.min(1, pull / THRESHOLD) }}
      >
        {loading ? "Synchronisation…" : armed ? "Relâche pour synchroniser" : "Tire pour synchroniser"}
      </div>
      {children}
    </div>
  );
}
