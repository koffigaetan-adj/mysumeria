import { prisma } from "@/lib/prisma";
import { getSoldeAt, getSoldeCourant } from "@/lib/balance";
import { categorize, type Category } from "@/lib/categories";

export type SeriesPoint = { label: string; date: string; value: number };
export type CategoryTotal = { category: Category; total: number; count: number };

export type ChartData = {
  daily: SeriesPoint[];
  monthly: SeriesPoint[];
  categories: CategoryTotal[];
  monthDebits: number;
};

const DAY_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const MONTH_FMT = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" });

const MAX_CATEGORY_BARS = 6;

export async function getChartData(now = new Date()): Promise<ChartData> {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [{ solde: startSolde }, recent, { solde: current }, monthDebits, monthlyOpenings] = await Promise.all([
    getSoldeAt(dayStart),
    prisma.transaction.findMany({
      where: { date: { gte: dayStart } },
      orderBy: { date: "asc" },
      select: { date: true, montant: true, type: true },
    }),
    getSoldeCourant(),
    prisma.transaction.findMany({
      where: { type: "DEBIT", date: { gte: monthStart } },
      select: { motif: true, label: true, category: true, montant: true },
    }),
    // Solde en fin de chacun des 5 mois précédents (= solde au 1er du mois suivant)
    Promise.all(
      Array.from({ length: 5 }, (_, i) => {
        const end = new Date(now.getFullYear(), now.getMonth() - 4 + i, 1);
        return getSoldeAt(end).then((r) => ({ end, value: r.solde }));
      })
    ),
  ]);

  // Solde jour par jour sur 30 jours
  const daily: SeriesPoint[] = [];
  let running = startSolde;
  let i = 0;
  for (let d = 0; d < 30; d++) {
    const day = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + d);
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    while (i < recent.length && recent[i].date < dayEnd) {
      running += (recent[i].type === "CREDIT" ? 1 : -1) * Number(recent[i].montant);
      i++;
    }
    daily.push({ label: DAY_FMT.format(day), date: day.toISOString(), value: d === 29 ? current : running });
  }

  // Solde en fin de mois sur 6 mois (le mois en cours = solde actuel)
  const monthly: SeriesPoint[] = monthlyOpenings.map(({ end, value }) => {
    const month = new Date(end.getFullYear(), end.getMonth() - 1, 1);
    return { label: MONTH_FMT.format(month), date: month.toISOString(), value };
  });
  monthly.push({ label: MONTH_FMT.format(monthStart), date: monthStart.toISOString(), value: current });

  // Dépenses du mois par catégorie (top 6, le reste replié dans "Autre")
  const totals = new Map<Category, CategoryTotal>();
  let debitsSum = 0;
  for (const t of monthDebits) {
    const category = categorize(t.label ?? t.motif, t.category);
    const montant = Number(t.montant);
    debitsSum += montant;
    const entry = totals.get(category) ?? { category, total: 0, count: 0 };
    entry.total += montant;
    entry.count += 1;
    totals.set(category, entry);
  }
  const sorted = [...totals.values()].sort((a, b) => b.total - a.total);
  const head = sorted.filter((c) => c.category !== "Autre").slice(0, MAX_CATEGORY_BARS - 1);
  const tail = sorted.filter((c) => !head.includes(c));
  const categories = [...head];
  if (tail.length > 0) {
    categories.push({
      category: "Autre",
      total: tail.reduce((s, c) => s + c.total, 0),
      count: tail.reduce((s, c) => s + c.count, 0),
    });
  }

  return { daily, monthly, categories, monthDebits: debitsSum };
}
