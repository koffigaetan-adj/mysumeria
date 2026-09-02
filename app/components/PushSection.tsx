"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "no-sw" | "denied" | "off" | "on";

export default function PushSection({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unsupported");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        setState("no-sw");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })();
  }, []);

  async function toggle() {
    if (!vapidPublicKey) return;
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (state === "on") {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setState("off");
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        const res = await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
        if (!res.ok) throw new Error("Le serveur a refusé l'abonnement.");
        setState("on");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const hint: Record<State, string> = {
    loading: "Vérification…",
    unsupported: "Ce navigateur ne prend pas en charge les notifications push.",
    "no-sw": "Disponible une fois l'appli installée (écran d'accueil) et en ligne — pas en mode développement.",
    denied: "Notifications bloquées dans les réglages du navigateur pour ce site.",
    off: "Reçois une notification sur cet appareil à chaque mouvement détecté.",
    on: "Activées sur cet appareil.",
  };

  const canToggle = (state === "on" || state === "off") && Boolean(vapidPublicKey);

  return (
    <div>
      {!vapidPublicKey && (
        <p className="mb-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Clés VAPID absentes sur le serveur (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).
        </p>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={!canToggle || busy}
        className="flex w-full items-center justify-between gap-4 py-2 text-left disabled:opacity-60"
      >
        <span>
          <span className="block text-sm font-medium">Notifications sur cet appareil</span>
          <span className="block text-xs text-ink-900/50 dark:text-white/50">{hint[state]}</span>
        </span>
        <span className="switch" data-on={state === "on"} />
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
