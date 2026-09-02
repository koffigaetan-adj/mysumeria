"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PinInput from "@/app/components/PinInput";
import { writeSavedLogin } from "@/lib/loginStorage";

export default function ReinitialiserPage() {
  const [token, setToken] = useState<string | null>(null);
  const [length, setLength] = useState<6 | 8>(8);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pin !== confirm) {
      setError("Les deux codes ne correspondent pas.");
      setConfirm("");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPin: pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Échec de la réinitialisation.");
        setPin("");
        setConfirm("");
        return;
      }
      writeSavedLogin({ email: data.email, pinLength: data.pinLength === 6 ? 6 : 8 });
      window.location.assign("/login?reinitialise=1");
    } catch {
      setError("Erreur réseau, réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl">My Sumeria</h1>
        <p className="mt-2 text-sm text-ink-900/60 dark:text-white/60">Choisis ton nouveau code de connexion</p>
      </div>

      {token === null ? null : !token ? (
        <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-center text-sm text-red-600 dark:text-red-300">
          Lien incomplet. Utilise le bouton du mail que tu as reçu, ou{" "}
          <Link href="/login" className="underline">
            refais une demande
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-center text-xs font-medium text-ink-900/60 dark:text-white/60">Longueur du code</p>
            <div className="flex gap-2">
              {([6, 8] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setLength(n);
                    setPin("");
                    setConfirm("");
                  }}
                  className={`flex-1 rounded-full py-2 text-sm font-medium transition ${
                    length === n ? "bg-brand-700 text-white dark:bg-brand-500" : "bg-white text-ink-900/70 dark:bg-ink-800 dark:text-white/70"
                  }`}
                >
                  {n} chiffres
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-center text-xs font-medium text-ink-900/60 dark:text-white/60">Nouveau code</p>
            <PinInput length={length} value={pin} onChange={setPin} disabled={busy} />
          </div>
          <div>
            <p className="mb-2 text-center text-xs font-medium text-ink-900/60 dark:text-white/60">Confirme le code</p>
            <PinInput length={length} value={confirm} onChange={setConfirm} disabled={busy} autoFocus={false} />
          </div>

          <button
            type="submit"
            disabled={busy || pin.length !== length || confirm.length !== length}
            className="w-full rounded-2xl bg-brand-600 py-4 text-base font-semibold text-white shadow-lg shadow-brand-900/30 transition hover:bg-brand-500 active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "Enregistrement…" : "Enregistrer mon nouveau code"}
          </button>

          {error && (
            <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-center text-sm font-medium text-red-600 dark:text-red-300">{error}</p>
          )}
        </form>
      )}
    </main>
  );
}
