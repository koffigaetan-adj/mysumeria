"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SyncContextValue = {
  sync: () => Promise<void>;
  loading: boolean;
  message: string | null;
  isError: boolean;
};

const SyncContext = createContext<SyncContextValue | null>(null);

const AUTO_SYNC_INTERVAL_MS = 3 * 60 * 1000; // synchro silencieuse toutes les 3 min quand l'app est ouverte
const FOCUS_SYNC_MIN_GAP_MS = 30 * 1000; // et au retour sur l'app, si la dernière date d'au moins 30 s
const MESSAGE_TTL_MS = 5 * 1000;

/** État de synchronisation partagé (bouton, tirer-pour-rafraîchir, synchro automatique). */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const inFlight = useRef(false);
  const lastSyncAt = useRef(0);

  const run = useCallback(
    async (silent: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (!silent) {
        setSyncing(true);
        setMessage(null);
      }
      try {
        const res = await fetch("/api/sync-emails", { method: "POST" });
        const data = await res.json();
        lastSyncAt.current = Date.now();
        if (!res.ok) {
          if (!silent) {
            setIsError(true);
            setMessage(data.error ?? "Erreur pendant la synchronisation");
          }
          return;
        }
        const created = data.transactionsCreated ?? 0;
        if (!silent) {
          setIsError(false);
          setMessage(
            created === 0
              ? "À jour — aucun nouveau mouvement."
              : `${created} nouveau${created > 1 ? "x" : ""} mouvement${created > 1 ? "s" : ""} ajouté${created > 1 ? "s" : ""}.`
          );
        }
        // En silencieux, on ne rafraîchit l'écran que s'il y a du nouveau (évite tout clignotement)
        if (!silent || created > 0) {
          startTransition(() => router.refresh());
        }
      } catch {
        if (!silent) {
          setIsError(true);
          setMessage("Erreur réseau pendant la synchronisation");
        }
      } finally {
        inFlight.current = false;
        if (!silent) setSyncing(false);
      }
    },
    [router]
  );

  // Le message de confirmation s'efface tout seul
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), MESSAGE_TTL_MS);
    return () => clearTimeout(t);
  }, [message]);

  // Synchro silencieuse : à l'ouverture, périodiquement, et au retour sur l'app
  useEffect(() => {
    run(true);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") run(true);
    }, AUTO_SYNC_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastSyncAt.current > FOCUS_SYNC_MIN_GAP_MS) {
        run(true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [run]);

  return (
    <SyncContext.Provider value={{ sync: () => run(false), loading: syncing || isPending, message, isError }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync doit être utilisé dans un <SyncProvider>");
  return ctx;
}
