"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/app/components/ThemeToggle";
import { DownloadIcon, LogOutIcon, MailIcon, MenuIcon, SendIcon, SettingsIcon, XIcon } from "@/app/components/Icons";

function Item({
  icon,
  label,
  hint,
  onClick,
  href,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const className =
    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition hover:bg-ink-900/5 disabled:opacity-50 dark:hover:bg-white/5";
  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-200">
        {icon}
      </span>
      <span className="flex-1">
        {label}
        {hint && <span className="block text-xs font-normal text-ink-900/50 dark:text-white/50">{hint}</span>}
      </span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
}

export default function Menu({ periode }: { periode: string }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // La confirmation s'efface toute seule
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(t);
  }, [note]);

  async function emailStatement() {
    setSending(true);
    setNote(null);
    try {
      const res = await fetch("/api/statement-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periode }),
      });
      const data = await res.json().catch(() => ({}));
      setNote(res.ok ? `Relevé envoyé à ${data.to}.` : (data.error ?? "Échec de l'envoi."));
    } catch {
      setNote("Erreur réseau.");
    } finally {
      setSending(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-900/10 text-ink-900 backdrop-blur transition hover:bg-ink-900/15 active:scale-95 dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
      >
        <MenuIcon />
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
          />
          <aside className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col bg-brand-50 p-4 shadow-2xl dark:bg-ink-800">
            <div className="mb-3 flex items-center justify-between px-2">
              <span className="font-display text-2xl">My Sumeria</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink-900/5 dark:hover:bg-white/10"
              >
                <XIcon />
              </button>
            </div>

            <nav className="flex flex-col gap-0.5">
              <div className="px-3 py-1">
                <ThemeToggle />
              </div>
              <Item icon={<SettingsIcon />} label="Paramètres" hint="Alertes, code, profil" href="/parametres" onClick={() => setOpen(false)} />
              <Item
                icon={<SendIcon />}
                label={sending ? "Envoi en cours…" : "M'envoyer le relevé par mail"}
                hint="PDF de la période affichée"
                onClick={emailStatement}
                disabled={sending}
              />
              <Item icon={<DownloadIcon />} label="Télécharger le relevé (PDF)" href={`/api/statement-pdf?periode=${periode}`} />
              <Item icon={<MailIcon />} label="Configurer l'accès Gmail" href="/api/gmail/auth" />
            </nav>

            {note && (
              <p className="mt-3 rounded-xl bg-brand-500/10 px-3 py-2 text-xs text-brand-800 dark:text-brand-200">{note}</p>
            )}

            <div className="mt-auto border-t border-ink-900/10 pt-2 dark:border-white/10">
              <Item icon={<LogOutIcon />} label="Déconnexion" onClick={logout} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
