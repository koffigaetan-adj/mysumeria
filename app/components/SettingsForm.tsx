"use client";

import { useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/app/components/ThemeToggle";
import PinInput from "@/app/components/PinInput";
import PasskeySection from "@/app/components/PasskeySection";
import PushSection from "@/app/components/PushSection";
import ProfileForm from "@/app/components/ProfileForm";
import { readSavedLogin, writeSavedLogin } from "@/lib/loginStorage";
import { XIcon } from "@/app/components/Icons";

type Prefs = {
  notifyOnTransaction: boolean;
  pushOnTransaction: boolean;
  monthlyStatement: boolean;
  notifyOnLogin: boolean;
  pushOnLogin: boolean;
};

type User = Prefs & {
  email: string;
  pinLength: number;
  firstName: string | null;
  lastName: string | null;
  avatarDataUrl: string | null;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl bg-white p-4 dark:bg-ink-800">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-white/50">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="flex justify-center py-1">
      <span className="switch" data-on={checked} />
    </button>
  );
}

/** Une ligne du tableau d'alertes : libellé + interrupteur Mail + interrupteur Push (ou tiret). */
function AlertRow({
  label,
  hint,
  mail,
  push,
}: {
  label: string;
  hint: string;
  mail: { checked: boolean; onChange: (v: boolean) => void };
  push: { checked: boolean; onChange: (v: boolean) => void } | null;
}) {
  return (
    <div className="grid grid-cols-[1fr_56px_56px] items-center gap-2 border-t border-ink-900/5 py-2.5 dark:border-white/5">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-ink-900/50 dark:text-white/50">{hint}</span>
      </span>
      <Toggle label={`${label} par mail`} checked={mail.checked} onChange={mail.onChange} />
      {push ? (
        <Toggle label={`${label} par notification`} checked={push.checked} onChange={push.onChange} />
      ) : (
        <span className="text-center text-xs text-ink-900/30 dark:text-white/30">—</span>
      )}
    </div>
  );
}

export default function SettingsForm({
  user,
  emailsConfigured,
  unparsedCount,
  vapidPublicKey,
  isAdmin,
  instantSync,
}: {
  user: User;
  emailsConfigured: boolean;
  unparsedCount: number;
  vapidPublicKey: string | null;
  isAdmin: boolean;
  instantSync: { configured: boolean; expiration: string | null };
}) {
  const [watchExpiration, setWatchExpiration] = useState<string | null>(instantSync.expiration);
  const [watchBusy, setWatchBusy] = useState(false);
  const [watchNote, setWatchNote] = useState<string | null>(null);

  async function renewWatch() {
    setWatchBusy(true);
    setWatchNote(null);
    try {
      const res = await fetch("/api/gmail/watch", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWatchNote(data.error ?? "Échec.");
        return;
      }
      setWatchExpiration(data.expiration ?? null);
      setWatchNote("Détection instantanée activée.");
    } catch {
      setWatchNote("Erreur réseau.");
    } finally {
      setWatchBusy(false);
    }
  }
  const watchActive = watchExpiration ? new Date(watchExpiration) > new Date() : false;
  const [prefs, setPrefs] = useState<Prefs>({
    notifyOnTransaction: user.notifyOnTransaction,
    pushOnTransaction: user.pushOnTransaction,
    monthlyStatement: user.monthlyStatement,
    notifyOnLogin: user.notifyOnLogin,
    pushOnLogin: user.pushOnLogin,
  });
  const [prefsNote, setPrefsNote] = useState<string | null>(null);

  const [currentPin, setCurrentPin] = useState("");
  const [newLength, setNewLength] = useState<6 | 8>(user.pinLength === 6 ? 6 : 8);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinLength, setPinLength] = useState(user.pinLength);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinNote, setPinNote] = useState<{ text: string; error: boolean } | null>(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [gmailModalOpen, setGmailModalOpen] = useState(false);

  function openPinModal() {
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setNewLength(pinLength === 6 ? 6 : 8);
    setPinNote(null);
    setPinModalOpen(true);
  }

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
        setPinModalOpen(false);
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

      <Section title="Alertes">
        {!emailsConfigured && (
          <p className="mb-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            L&apos;envoi d&apos;emails n&apos;est pas configuré sur le serveur (GMAIL_SMTP_USER / GMAIL_APP_PASSWORD).
          </p>
        )}
        <div className="grid grid-cols-[1fr_56px_56px] gap-2 pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-900/50 dark:text-white/50">
          <span />
          <span>Mail</span>
          <span>Push</span>
        </div>
        <AlertRow
          label="Mouvement sur le compte"
          hint="À chaque nouvelle transaction détectée"
          mail={{ checked: prefs.notifyOnTransaction, onChange: (v) => updatePrefs({ notifyOnTransaction: v }) }}
          push={{ checked: prefs.pushOnTransaction, onChange: (v) => updatePrefs({ pushOnTransaction: v }) }}
        />
        <AlertRow
          label="Relevé mensuel"
          hint="Le 1er du mois, PDF en pièce jointe"
          mail={{ checked: prefs.monthlyStatement, onChange: (v) => updatePrefs({ monthlyStatement: v }) }}
          push={null}
        />
        <AlertRow
          label="Nouvelle connexion"
          hint="Date, appareil, localisation approximative"
          mail={{ checked: prefs.notifyOnLogin, onChange: (v) => updatePrefs({ notifyOnLogin: v }) }}
          push={{ checked: prefs.pushOnLogin, onChange: (v) => updatePrefs({ pushOnLogin: v }) }}
        />
        <p className="mt-2 text-xs text-ink-900/50 dark:text-white/50">
          Les mails vont à {user.email}. Les notifications arrivent sur les appareils activés ci-dessous.
        </p>
        {prefsNote && <p className="mt-2 text-xs text-red-500">{prefsNote}</p>}

        <div className="mt-3 border-t border-ink-900/10 pt-2 dark:border-white/10">
          <PushSection vapidPublicKey={vapidPublicKey} />
        </div>
      </Section>

      <Section title="Face ID / empreinte">
        <PasskeySection />
      </Section>

      <Section title="Profil">
        <ProfileForm user={{ email: user.email, firstName: user.firstName, lastName: user.lastName, avatarDataUrl: user.avatarDataUrl }} />

        <p className="mt-4 border-t border-ink-900/10 pt-3 text-sm dark:border-white/10">
          <span className="text-ink-900/50 dark:text-white/50">Code de connexion : </span>
          {pinLength} chiffres
        </p>
        <button
          type="button"
          onClick={openPinModal}
          className="mt-2 w-full rounded-2xl bg-ink-900/5 py-3 text-sm font-medium transition hover:bg-ink-900/10 dark:bg-white/10 dark:hover:bg-white/15"
        >
          Modifier mon code
        </button>
        {pinNote && !pinModalOpen && (
          <p className={`mt-2 text-center text-xs ${pinNote.error ? "text-red-500" : "text-brand-700 dark:text-brand-200"}`}>{pinNote.text}</p>
        )}
      </Section>

      {pinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fermer" onClick={() => setPinModalOpen(false)} className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" />
          <form
            onSubmit={changePin}
            className="relative flex w-full max-w-md flex-col gap-4 rounded-t-3xl bg-brand-50 p-5 pb-8 shadow-2xl sm:rounded-3xl dark:bg-ink-800"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Modifier mon code</h3>
              <button type="button" onClick={() => setPinModalOpen(false)} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink-900/5 dark:hover:bg-white/10">
                <XIcon />
              </button>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-ink-900/60 dark:text-white/60">Code actuel</p>
              <PinInput length={pinLength} value={currentPin} onChange={setCurrentPin} disabled={pinBusy} autoFocus />
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
        </div>
      )}

      {isAdmin && (
        <Section title="Administration">
          <button
            type="button"
            onClick={() => setGmailModalOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-ink-900/5 px-4 py-3 text-left text-sm font-medium transition hover:bg-ink-900/10 dark:bg-white/10 dark:hover:bg-white/15"
          >
            <span>
              Gmail &amp; parseur
              <span className="block text-xs font-normal text-ink-900/50 dark:text-white/50">
                {watchActive ? "Détection instantanée active" : "Détection instantanée inactive"}
                {unparsedCount > 0 && ` · ${unparsedCount} email${unparsedCount > 1 ? "s" : ""} ignoré${unparsedCount > 1 ? "s" : ""}`}
              </span>
            </span>
            <span aria-hidden className="text-ink-900/40 dark:text-white/40">›</span>
          </button>
        </Section>
      )}

      {isAdmin && gmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fermer" onClick={() => setGmailModalOpen(false)} className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-t-3xl bg-brand-50 p-5 pb-8 shadow-2xl sm:rounded-3xl dark:bg-ink-800">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Gmail &amp; parseur</h3>
              <button type="button" onClick={() => setGmailModalOpen(false)} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink-900/5 dark:hover:bg-white/10">
                <XIcon />
              </button>
            </div>

            <p className="text-xs text-ink-900/60 dark:text-white/60">
              {unparsedCount > 0
                ? `${unparsedCount} email${unparsedCount > 1 ? "s" : ""} non transformé${unparsedCount > 1 ? "s" : ""} en transaction.`
                : "Tous les emails synchronisés ont été reconnus."}
            </p>
            <Link
              href="/parametres/emails"
              className="mt-3 block rounded-2xl bg-ink-900/5 py-3 text-center text-sm font-medium transition hover:bg-ink-900/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              Emails ignorés{unparsedCount > 0 ? ` (${unparsedCount})` : ""}
            </Link>
            <a
              href="/api/gmail/auth"
              className="mt-2 block rounded-2xl bg-ink-900/5 py-3 text-center text-sm font-medium transition hover:bg-ink-900/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              Reconfigurer l&apos;accès Gmail
            </a>

            <div className="mt-4 border-t border-ink-900/10 pt-3 dark:border-white/10">
              <p className="text-sm font-medium">Détection instantanée</p>
              <p className="mt-0.5 text-xs text-ink-900/60 dark:text-white/60">
                {!instantSync.configured
                  ? "Non configurée : GMAIL_PUBSUB_TOPIC absent (voir README, étape 8 ter)."
                  : watchActive
                    ? `Active — Gmail prévient l'appli à chaque nouveau mail (renouvelée automatiquement, valable jusqu'au ${new Date(watchExpiration!).toLocaleDateString("fr-FR")}).`
                    : "Configurée mais pas encore activée sur la boîte Gmail."}
              </p>
              <button
                type="button"
                onClick={renewWatch}
                disabled={!instantSync.configured || watchBusy}
                className="mt-2 w-full rounded-2xl bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-500 active:scale-[0.98] disabled:opacity-50"
              >
                {watchBusy ? "Activation…" : watchActive ? "Renouveler maintenant" : "Activer la détection instantanée"}
              </button>
              {watchNote && <p className="mt-2 text-center text-xs text-brand-700 dark:text-brand-200">{watchNote}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
