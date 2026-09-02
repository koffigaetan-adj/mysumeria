"use client";

import { useState } from "react";
import ThemeToggle from "@/app/components/ThemeToggle";
import PinInput from "@/app/components/PinInput";
import { readSavedLogin, writeSavedLogin } from "@/lib/loginStorage";

type User = {
  email: string;
  pinLength: number;
  notifyOnTransaction: boolean;
  monthlyStatement: boolean;
  notifyOnLogin: boolean;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl bg-white p-4 dark:bg-ink-800">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-white/50">{title}</h2>
      {children}
    </section>
  );
}

function Switch({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-4 py-2 text-left disabled:opacity-50"
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-ink-900/50 dark:text-white/50">{hint}</span>
      </span>
      <span className="switch" data-on={checked} />
    </button>
  );
}

export default function SettingsForm({
  user,
  emailsConfigured,
  unparsedCount,
}: {
  user: User;
  emailsConfigured: boolean;
  unparsedCount: number;
}) {
  const [prefs, setPrefs] = useState({
    notifyOnTransaction: user.notifyOnTransaction,
    monthlyStatement: user.monthlyStatement,
    notifyOnLogin: user.notifyOnLogin,
  });
  const [prefsNote, setPrefsNote] = useState<string | null>(null);

  const [currentPin, setCurrentPin] = useState("");
  const [newLength, setNewLength] = useState<6 | 8>(user.pinLength === 6 ? 6 : 8);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinLength, setPinLength] = useState(user.pinLength);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinNote, setPinNote] = useState<{ text: string; error: boolean } | null>(null);

  async function updatePrefs(patch: Partial<typeof prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setPrefsNote(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setPrefs(prefs);
      setPrefsNote("Impossible d'enregistrer, réessaie.");
    }
  }

  async function changePin(e: React.FormEvent) {
    e.preventDefault();
    setPinNote(null);
    if (newPin !== confirmPin) {
      setPinNote({ text: "Les deux nouveaux codes ne correspondent pas.", error: true });
      setConfirmPin("");
      return;
    }
    setPinBusy(true);
    try {
      const res = await fetch("/api/profile/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPinLength(newLength);
        const saved = readSavedLogin();
        if (saved?.email === user.email) writeSavedLogin({ email: user.email, pinLength: newLength });
        setPinNote({ text: `Code modifié (${newLength} chiffres).`, error: false });
      } else {
        setPinNote({ text: data.error ?? "Échec de la modification.", error: true });
      }
    } catch {
      setPinNote({ text: "Erreur réseau.", error: true });
    } finally {
      setPinBusy(false);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    }
  }

  return (
    <div>
      <Section title="Apparence">
        <ThemeToggle />
      </Section>

      <Section title="Alertes par email">
        {!emailsConfigured && (
          <p className="mb-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            L&apos;envoi d&apos;emails n&apos;est pas configuré sur le serveur (GMAIL_SMTP_USER / GMAIL_APP_PASSWORD).
          </p>
        )}
        <Switch
          label="Mouvement sur le compte"
          hint={`Un mail à ${user.email} à chaque nouvelle transaction détectée`}
          checked={prefs.notifyOnTransaction}
          onChange={(v) => updatePrefs({ notifyOnTransaction: v })}
        />
        <Switch
          label="Relevé mensuel"
          hint="Le 1er de chaque mois, avec le PDF en pièce jointe"
          checked={prefs.monthlyStatement}
          onChange={(v) => updatePrefs({ monthlyStatement: v })}
        />
        <Switch
          label="Nouvelle connexion"
          hint="Un mail à chaque connexion : date, appareil, localisation approximative, IP"
          checked={prefs.notifyOnLogin}
          onChange={(v) => updatePrefs({ notifyOnLogin: v })}
        />
        {prefsNote && <p className="mt-2 text-xs text-red-500">{prefsNote}</p>}
      </Section>

      <Section title="Profil">
        <p className="text-sm">
          <span className="text-ink-900/50 dark:text-white/50">Email : </span>
          {user.email}
        </p>
        <p className="mt-1 text-sm">
          <span className="text-ink-900/50 dark:text-white/50">Code actuel : </span>
          {pinLength} chiffres
        </p>

        <form onSubmit={changePin} className="mt-4 flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-medium text-ink-900/60 dark:text-white/60">Code actuel</p>
            <PinInput length={pinLength} value={currentPin} onChange={setCurrentPin} disabled={pinBusy} autoFocus={false} />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-ink-900/60 dark:text-white/60">Longueur du nouveau code</p>
            <div className="flex gap-2">
              {([6, 8] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setNewLength(n);
                    setNewPin("");
                    setConfirmPin("");
                  }}
                  className={`flex-1 rounded-full py-2 text-sm font-medium transition ${
                    newLength === n
                      ? "bg-brand-700 text-white dark:bg-brand-500"
                      : "bg-ink-900/5 text-ink-900/70 dark:bg-white/10 dark:text-white/70"
                  }`}
                >
                  {n} chiffres
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-ink-900/60 dark:text-white/60">Nouveau code</p>
            <PinInput length={newLength} value={newPin} onChange={setNewPin} disabled={pinBusy} autoFocus={false} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-ink-900/60 dark:text-white/60">Confirme le nouveau code</p>
            <PinInput length={newLength} value={confirmPin} onChange={setConfirmPin} disabled={pinBusy} autoFocus={false} />
          </div>

          <button
            type="submit"
            disabled={pinBusy || currentPin.length !== pinLength || newPin.length !== newLength || confirmPin.length !== newLength}
            className="w-full rounded-2xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-500 active:scale-[0.98] disabled:opacity-50"
          >
            {pinBusy ? "Modification…" : "Changer le code"}
          </button>
          {pinNote && (
            <p className={`text-center text-xs ${pinNote.error ? "text-red-500" : "text-brand-700 dark:text-brand-200"}`}>{pinNote.text}</p>
          )}
        </form>
      </Section>

      <Section title="Gmail">
        <p className="text-xs text-ink-900/60 dark:text-white/60">
          {unparsedCount > 0
            ? `${unparsedCount} email${unparsedCount > 1 ? "s" : ""} non reconnu${unparsedCount > 1 ? "s" : ""} par le parseur (table UnparsedEmail, visible avec npm run db:studio).`
            : "Tous les emails synchronisés ont été reconnus."}
        </p>
        <a
          href="/api/gmail/auth"
          className="mt-3 block rounded-2xl bg-ink-900/5 py-3 text-center text-sm font-medium transition hover:bg-ink-900/10 dark:bg-white/10 dark:hover:bg-white/15"
        >
          Reconfigurer l&apos;accès Gmail
        </a>
      </Section>
    </div>
  );
}
