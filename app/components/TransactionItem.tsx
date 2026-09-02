"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";
import { ArrowDownLeftIcon, ArrowUpRightIcon, XIcon } from "@/app/components/Icons";

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export type TransactionView = {
  id: string;
  dateLabel: string;
  montant: number;
  type: "CREDIT" | "DEBIT";
  motif: string | null;
  label: string | null;
  note: string | null;
  category: string | null;
  autoCategory: string;
};

export default function TransactionItem({ t }: { t: TransactionView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(t.label ?? "");
  const [note, setNote] = useState(t.note ?? "");
  const [category, setCategory] = useState(t.category ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const credit = t.type === "CREDIT";
  const displayName = t.label ?? t.motif ?? "Motif inconnu";
  const displayCategory = t.category ?? t.autoCategory;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, note, category: category || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Échec de l'enregistrement.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-left transition active:scale-[0.99] dark:bg-ink-800"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              credit ? "bg-brand-500/15 text-brand-700 dark:text-brand-200" : "bg-red-500/10 text-red-600 dark:text-red-300"
            }`}
          >
            {credit ? <ArrowDownLeftIcon className="h-4 w-4" /> : <ArrowUpRightIcon className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-ink-900/50 dark:text-white/50">
              {t.dateLabel}
              {!credit && <> · {displayCategory}</>}
              {t.note && <> · {t.note}</>}
            </p>
          </div>
        </div>
        <p className={`shrink-0 text-base font-semibold tabular-nums ${credit ? "text-brand-700 dark:text-brand-200" : "text-red-600 dark:text-red-300"}`}>
          {credit ? "+" : "−"}
          {EUR.format(t.montant)}
        </p>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fermer" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" />
          <form
            onSubmit={save}
            className="relative w-full max-w-md rounded-t-3xl bg-brand-50 p-5 pb-8 shadow-2xl sm:rounded-3xl dark:bg-ink-800"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink-900/50 dark:text-white/50">{t.motif ?? "Motif inconnu"}</p>
                <p className={`text-2xl font-semibold ${credit ? "text-brand-700 dark:text-brand-200" : "text-red-600 dark:text-red-300"}`}>
                  {credit ? "+" : "−"}
                  {EUR.format(t.montant)}
                </p>
                <p className="text-xs text-ink-900/50 dark:text-white/50">{t.dateLabel}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-ink-900/5 dark:hover:bg-white/10">
                <XIcon />
              </button>
            </div>

            <label className="block text-xs font-medium text-ink-900/60 dark:text-white/60">
              Nom affiché
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t.motif ?? "Ex : Loyer, Courses…"}
                maxLength={80}
                className="mt-1 w-full rounded-xl border border-ink-900/10 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-ink-900 dark:text-white"
              />
            </label>

            <label className="mt-3 block text-xs font-medium text-ink-900/60 dark:text-white/60">
              Note
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex : remboursé par Julienne le 12"
                maxLength={500}
                rows={2}
                className="mt-1 w-full rounded-xl border border-ink-900/10 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-ink-900 dark:text-white"
              />
            </label>

            {!credit && (
              <label className="mt-3 block text-xs font-medium text-ink-900/60 dark:text-white/60">
                Catégorie
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-ink-900/10 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-ink-900 dark:text-white"
                >
                  <option value="">Automatique ({t.autoCategory})</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="mt-5 w-full rounded-2xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-500 active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
