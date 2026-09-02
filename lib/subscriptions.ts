import { prisma } from "@/lib/prisma";
import { categorize, type Category } from "@/lib/categories";

export type Subscription = {
  name: string;
  amount: number;
  count: number;
  lastDate: Date;
  nextDate: Date;
  category: Category;
};

const LOOKBACK_MONTHS = 6;
const MIN_OCCURRENCES = 2;
const GAP_MIN_DAYS = 25;
const GAP_MAX_DAYS = 36;
const AMOUNT_TOLERANCE = 0.2; // ±20 % autour du montant médian
const ACTIVE_WITHIN_DAYS = 45; // sinon considéré comme résilié

const DAY_MS = 24 * 60 * 60 * 1000;

/** Clé de regroupement : motif sans chiffres/dates/ponctuation, 3 premiers mots. */
function groupKey(motif: string): string {
  return motif
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\d*#/.,:;'"()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Repère les débits mensuels récurrents (même motif, montant proche, ~30 jours d'écart).
 * Le motif affiché est celui de la dernière occurrence (ou son libellé personnalisé).
 */
export async function detectSubscriptions(now = new Date()): Promise<{ items: Subscription[]; monthlyTotal: number }> {
  const since = new Date(now.getFullYear(), now.getMonth() - LOOKBACK_MONTHS, 1);
  const debits = await prisma.transaction.findMany({
    where: { type: "DEBIT", date: { gte: since } },
    select: { date: true, montant: true, motif: true, label: true, category: true },
    orderBy: { date: "asc" },
  });

  const groups = new Map<string, typeof debits>();
  for (const t of debits) {
    const name = t.label ?? t.motif;
    if (!name) continue;
    const key = groupKey(name);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const items: Subscription[] = [];
  for (const occurrences of groups.values()) {
    if (occurrences.length < MIN_OCCURRENCES) continue;

    const gaps = occurrences.slice(1).map((t, i) => (t.date.getTime() - occurrences[i].date.getTime()) / DAY_MS);
    const gap = median(gaps);
    if (gap < GAP_MIN_DAYS || gap > GAP_MAX_DAYS) continue;

    const amounts = occurrences.map((t) => Number(t.montant));
    const ref = median(amounts);
    if (!amounts.every((a) => Math.abs(a - ref) <= ref * AMOUNT_TOLERANCE)) continue;

    const last = occurrences[occurrences.length - 1];
    if ((now.getTime() - last.date.getTime()) / DAY_MS > ACTIVE_WITHIN_DAYS) continue;

    items.push({
      name: last.label ?? last.motif ?? "Abonnement",
      amount: Number(last.montant),
      count: occurrences.length,
      lastDate: last.date,
      nextDate: new Date(last.date.getTime() + Math.round(gap) * DAY_MS),
      category: categorize(last.label ?? last.motif, last.category),
    });
  }

  items.sort((a, b) => b.amount - a.amount);
  return { items, monthlyTotal: items.reduce((s, i) => s + i.amount, 0) };
}
