import { prisma } from "@/lib/prisma";

/**
 * Solde calculé à une date donnée : soldeInitial + crédits - débits sur les
 * transactions entre soldeInitialDate (incluse) et `at` (exclue).
 */
export async function getSoldeAt(at: Date): Promise<{ solde: number; configured: boolean }> {
  const config = await prisma.accountConfig.findUnique({ where: { id: 1 } });
  if (!config) return { solde: 0, configured: false };

  const [credits, debits] = await Promise.all([
    sumMontant("CREDIT", config.soldeInitialDate, at),
    sumMontant("DEBIT", config.soldeInitialDate, at),
  ]);

  return { solde: Number(config.soldeInitial) + credits - debits, configured: true };
}

export function getSoldeCourant(): Promise<{ solde: number; configured: boolean }> {
  // +1s pour être sûr d'inclure une transaction qui viendrait d'être insérée à l'instant "now"
  return getSoldeAt(new Date(Date.now() + 1000));
}

export type MonthStats = {
  credits: number;
  debits: number;
  prevDebits: number;
};

/** Crédits/débits du mois en cours, et débits du mois précédent pour comparaison. */
export async function getMonthStats(now = new Date()): Promise<MonthStats> {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [credits, debits, prevDebits] = await Promise.all([
    sumMontant("CREDIT", start, end),
    sumMontant("DEBIT", start, end),
    sumMontant("DEBIT", prevStart, start),
  ]);
  return { credits, debits, prevDebits };
}

async function sumMontant(type: "CREDIT" | "DEBIT", from: Date, to: Date): Promise<number> {
  const result = await prisma.transaction.aggregate({
    _sum: { montant: true },
    where: { type, date: { gte: from, lt: to } },
  });
  return Number(result._sum.montant ?? 0);
}
