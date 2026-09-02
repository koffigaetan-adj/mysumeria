import type { Subscription } from "@/lib/subscriptions";
import CategoryAvatar from "@/app/components/CategoryAvatar";

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

export default function SubscriptionsCard({ items, monthlyTotal }: { items: Subscription[]; monthlyTotal: number }) {
  return (
    <section className="rounded-2xl bg-white p-4 dark:bg-ink-800">
      <h2 className="text-sm font-medium">Abonnements détectés</h2>
      <p className="mt-0.5 text-xs text-ink-900/50 dark:text-white/50">
        {items.length === 0
          ? "Aucun débit mensuel récurrent repéré pour l'instant (il faut au moins deux prélèvements à ~30 jours d'écart)."
          : `${items.length} abonnement${items.length > 1 ? "s" : ""} · ${EUR.format(monthlyTotal)} / mois`}
      </p>

      {items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((s) => (
            <li key={`${s.name}-${s.amount}`} className="flex items-center gap-3">
              <CategoryAvatar category={s.category} name={s.name} type="DEBIT" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="text-xs text-ink-900/50 dark:text-white/50">
                  Prochain vers le {DATE_FMT.format(s.nextDate)} · {s.count} fois
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums">{EUR.format(s.amount)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
