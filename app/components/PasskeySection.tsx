"use client";

import { useEffect, useState } from "react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { XIcon } from "@/app/components/Icons";

export const PASSKEY_FLAG = "sumeria-passkey";

type Passkey = { id: string; deviceName: string | null; createdAt: string; lastUsedAt: string | null };

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export default function PasskeySection() {
  const [supported, setSupported] = useState(true);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  async function load() {
    const res = await fetch("/api/passkeys");
    if (res.ok) setPasskeys((await res.json()).passkeys);
  }

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
    load();
  }, []);

  async function add() {
    setBusy(true);
    setNote(null);
    try {
      const optionsRes = await fetch("/api/passkeys/options", { method: "POST" });
      if (!optionsRes.ok) throw new Error("Impossible de préparer l'enregistrement.");
      const optionsJSON = await optionsRes.json();
      const response = await startRegistration({ optionsJSON });
      const verifyRes = await fetch("/api/passkeys/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const data = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) throw new Error(data.error ?? "Enregistrement refusé.");
      try {
        window.localStorage.setItem(PASSKEY_FLAG, "1");
      } catch {
        // simple confort
      }
      setNote({ text: "Cet appareil peut maintenant se connecter avec Face ID / empreinte.", error: false });
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setNote({ text: /NotAllowedError|cancel|annul/i.test(msg) ? "Enregistrement annulé." : msg, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch("/api/passkeys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  return (
    <div>
      <p className="text-xs text-ink-900/60 dark:text-white/60">
        Déverrouille l&apos;appli avec Face ID, Touch ID, l&apos;empreinte Android ou Windows Hello. Le code reste utilisable en secours.
      </p>

      {passkeys.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-ink-900/5 px-3 py-2 text-sm dark:bg-white/5">
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.deviceName ?? "Appareil"}</span>
                <span className="block text-xs text-ink-900/50 dark:text-white/50">
                  Ajouté le {DATE_FMT.format(new Date(p.createdAt))}
                  {p.lastUsedAt && <> · utilisé le {DATE_FMT.format(new Date(p.lastUsedAt))}</>}
                </span>
              </span>
              <button type="button" onClick={() => remove(p.id)} aria-label="Supprimer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-900/50 hover:bg-ink-900/10 dark:text-white/50 dark:hover:bg-white/10">
                <XIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={add}
        disabled={busy || !supported}
        className="mt-3 w-full rounded-2xl bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-500 active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "En attente de l'appareil…" : "Ajouter cet appareil"}
      </button>
      {!supported && <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">Ce navigateur ne prend pas en charge Face ID / empreinte.</p>}
      {note && <p className={`mt-2 text-xs ${note.error ? "text-red-500" : "text-brand-700 dark:text-brand-200"}`}>{note.text}</p>}
    </div>
  );
}
