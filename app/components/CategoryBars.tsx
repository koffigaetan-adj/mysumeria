import type { CategoryTotal } from "@/lib/charts";

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Dépenses du mois par catégorie : barres horizontales, une seule teinte, valeurs en bout. */
export default function CategoryBars({ categories, total }: { categories: CategoryTotal[]; total: number }) {
  const max = Math.max(...categories.map((c) => c.total), 1);

  return (
    <section className="rounded-2xl bg-white p-4 dark:bg-ink-800">
      <h2 className="text-sm font-medium">Dépenses du mois par catégorie</h2>
      <p className="mt-0.5 text-xs text-ink-900/50 dark:text-white/50">
        {categories.length === 0 ? "Aucune dépense ce mois-ci." : `${EUR.format(total)} au total`}
      </p>

      {categories.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2.5">
          {categories.map((c) => {
            const share = total > 0 ? Math.round((c.total / total) * 100) : 0;
            return (
              <li key={c.category} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-xs">
                <span className="truncate" title={`${c.count} opération${c.count > 1 ? "s" : ""}`}>
                  {c.category}
                </span>
                <span className="relative h-3 overflow-hidden rounded-r-[4px]">
                  <span
                    className="absolute inset-y-0 left-0 rounded-r-[4px]"
                    style={{ width: `${(c.total / max) * 100}%`, background: "var(--viz-series)" }}
                    aria-hidden
                  />
                </span>
                <span className="tabular-nums">
                  {EUR.format(c.total)}
                  <span className="ml-1.5 text-ink-900/40 dark:text-white/40">{share}%</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
