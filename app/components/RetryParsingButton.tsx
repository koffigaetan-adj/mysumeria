"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RetryParsingButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/unparsed/retry", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(data.error ?? "Échec.");
        return;
      }
      setNote(
        data.converted === 0
          ? "Aucun email supplémentaire reconnu."
          : `${data.converted} email${data.converted > 1 ? "s" : ""} transformé${data.converted > 1 ? "s" : ""} en transaction.`
      );
      router.refresh();
    } catch {
      setNote("Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={retry}
        disabled={disabled || busy}
        className="w-full rounded-2xl bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-500 active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "Analyse en cours…" : "Réessayer le parsing"}
      </button>
      {note && <p className="mt-2 text-center text-xs text-brand-700 dark:text-brand-200">{note}</p>}
    </div>
  );
}
