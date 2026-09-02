"use client";

import { useEffect, useRef, useState } from "react";
import PinInput from "@/app/components/PinInput";
import PasskeyLoginButton from "@/app/components/PasskeyLoginButton";
import { readSavedLogin, writeSavedLogin } from "@/lib/loginStorage";
import { markActive } from "@/lib/idle";

const DEFAULT_PIN_LENGTH = 8;

async function fetchPinLength(email: string): Promise<number> {
  try {
    const res = await fetch("/api/auth/pin-length", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    return data.pinLength === 6 ? 6 : 8;
  } catch {
    return DEFAULT_PIN_LENGTH;
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [emailLocked, setEmailLocked] = useState(false);
  const [pinLength, setPinLength] = useState(DEFAULT_PIN_LENGTH);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  // Email mémorisé → champ grisé, et nombre de cases connu tout de suite.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verrouille") === "1") setInfo("Session verrouillée après 30 min d'inactivité — reconnecte-toi.");
    if (params.get("reinitialise") === "1") setInfo("Nouveau code enregistré — connecte-toi avec.");
    const saved = readSavedLogin();
    if (!saved) return;
    setEmail(saved.email);
    setPinLength(saved.pinLength);
    setEmailLocked(true);
    fetchPinLength(saved.email).then(setPinLength);
  }, []);

  async function refreshPinLength() {
    if (!email.includes("@")) return;
    const length = await fetchPinLength(email);
    if (length !== pinLength) {
      setPinLength(length);
      setPin("");
    }
  }

  const [forgotBusy, setForgotBusy] = useState(false);

  async function forgot() {
    if (!email.includes("@")) {
      setError("Indique d'abord ton adresse email.");
      return;
    }
    setForgotBusy(true);
    setError(null);
    try {
      await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setInfo(`Si un compte existe pour ${email}, un lien de réinitialisation vient d'être envoyé (valable 30 min). Pense à vérifier les spams.`);
    } catch {
      setError("Erreur réseau, réessaie.");
    } finally {
      setForgotBusy(false);
    }
  }

  async function submit(finalPin: string) {
    if (submitting.current || loading) return;
    if (!email.includes("@") || finalPin.length !== pinLength) return;

    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pin: finalPin }),
      });

      if (res.ok) {
        writeSavedLogin({ email, pinLength });
        markActive();
        // Navigation complète (pas router.push) : garantit que le cookie de session
        // est pris en compte et évite la course push/refresh qui annulait la redirection.
        window.location.assign("/");
        return;
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Email ou code invalide");
        setPin("");
      }
    } catch {
      setError("Erreur réseau, réessaie.");
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="noise relative mx-auto mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-br from-brand-500 to-brand-900 shadow-xl shadow-brand-900/40">
          <svg viewBox="0 0 100 100" className="h-14 w-14">
            <path d="M69 32 C69 20 31 20 31 34 C31 49 69 49 69 64 C69 79 31 79 31 68" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="font-display text-4xl">My Sumeria</h1>
        <p className="mt-2 text-sm text-ink-900/60 dark:text-white/60">
          {emailLocked ? "Entre ton code pour continuer" : "Connecte-toi avec ton email et ton code"}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(pin);
        }}
        className="flex flex-col gap-5"
      >
        <div>
          <input
            type="email"
            autoComplete="email"
            required
            placeholder="ton@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={refreshPinLength}
            readOnly={emailLocked}
            disabled={loading}
            className={`w-full rounded-2xl border px-4 py-4 text-base outline-none disabled:opacity-50 ${
              emailLocked
                ? "border-transparent bg-ink-900/5 text-ink-900/60 dark:bg-white/5 dark:text-white/60"
                : "border-ink-900/10 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/10 dark:bg-ink-800"
            }`}
          />
          {emailLocked && (
            <button
              type="button"
              onClick={() => {
                setEmailLocked(false);
                setPin("");
                setError(null);
              }}
              className="mt-1.5 w-full py-1 text-center text-xs text-ink-900/50 underline-offset-2 hover:underline dark:text-white/50"
            >
              Ce n&apos;est pas toi ? Changer d&apos;email
            </button>
          )}
        </div>

        <PinInput length={pinLength} value={pin} onChange={setPin} onComplete={submit} disabled={loading} />

        <button
          type="submit"
          disabled={loading || pin.length !== pinLength || !email.includes("@")}
          className="w-full rounded-2xl bg-brand-600 py-4 text-base font-semibold text-white shadow-lg shadow-brand-900/30 transition hover:bg-brand-500 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>

        <PasskeyLoginButton email={email} disabled={loading} onError={setError} />

        <button
          type="button"
          onClick={forgot}
          disabled={forgotBusy || loading}
          className="py-1 text-center text-sm text-ink-900/50 underline-offset-2 hover:underline disabled:opacity-50 dark:text-white/50"
        >
          {forgotBusy ? "Envoi…" : "Code oublié ?"}
        </button>
      </form>

      {info && !error && (
        <p className="mt-4 rounded-2xl bg-brand-500/10 px-4 py-3 text-center text-sm text-brand-800 dark:text-brand-200">{info}</p>
      )}
      {error && (
        <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-center text-sm font-medium text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
    </main>
  );
}
