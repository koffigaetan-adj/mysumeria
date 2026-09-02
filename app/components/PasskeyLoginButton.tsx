"use client";

import { useEffect, useState } from "react";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { writeSavedLogin } from "@/lib/loginStorage";
import { markActive } from "@/lib/idle";
import { PASSKEY_FLAG } from "@/app/components/PasskeySection";

function FaceIdIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0" />
    </svg>
  );
}

/** Bouton « Se connecter avec Face ID / empreinte » (affiché si le navigateur le permet). */
export default function PasskeyLoginButton({
  email,
  onError,
  disabled,
}: {
  email: string;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [primary, setPrimary] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setVisible(browserSupportsWebAuthn());
    try {
      setPrimary(window.localStorage.getItem(PASSKEY_FLAG) === "1");
    } catch {
      // ignoré
    }
  }, []);

  async function login() {
    setBusy(true);
    try {
      const optionsRes = await fetch("/api/auth/passkey/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.includes("@") ? email : undefined }),
      });
      if (!optionsRes.ok) throw new Error("Impossible de démarrer la connexion.");
      const optionsJSON = await optionsRes.json();
      const response = await startAuthentication({ optionsJSON });
      const verifyRes = await fetch("/api/auth/passkey/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const data = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) throw new Error(data.error ?? "Connexion refusée.");
      writeSavedLogin({ email: data.email, pinLength: data.pinLength === 6 ? 6 : 8 });
      markActive();
      window.location.assign("/");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onError(/NotAllowedError|cancel|annul|timed out/i.test(msg) ? "Connexion annulée." : msg);
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={login}
      disabled={disabled || busy}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
        primary
          ? "bg-brand-600 text-white shadow-lg shadow-brand-900/30 hover:bg-brand-500"
          : "bg-ink-900/5 text-ink-900 hover:bg-ink-900/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
      }`}
    >
      <FaceIdIcon />
      {busy ? "Vérification…" : "Face ID / empreinte"}
    </button>
  );
}
