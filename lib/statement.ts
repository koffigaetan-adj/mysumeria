import { prisma } from "@/lib/prisma";
import { getSoldeAt, getSoldeCourant } from "@/lib/balance";
import { type Periode, periodeStart, PERIODE_LABELS } from "@/lib/period";
import { type EmailTransaction } from "@/lib/email";

export type Statement = {
  title: string;
  subtitle: string;
  filename: string;
  openingBalance: number;
  closingBalance: number;
  transactions: EmailTransaction[];
};

/** Relevé pour une période du dashboard (mois en cours / 30 jours / tout). */
export async function buildPeriodStatement(periode: Periode): Promise<Statement> {
  const start = periodeStart(periode);

  const [transactions, opening, closing] = await Promise.all([
    prisma.transaction.findMany({
      where: start ? { date: { gte: start } } : undefined,
      orderBy: { date: "asc" },
    }),
    // "tout" → epoch : la plage [soldeInitialDate, epoch) est vide, donc opening = soldeInitial
    start ? getSoldeAt(start) : getSoldeAt(new Date(0)),
    getSoldeCourant(),
  ]);

  return {
    title: "Relevé de compte",
    subtitle: PERIODE_LABELS[periode],
    filename: `releve-${periode}-${new Date().toISOString().slice(0, 10)}.pdf`,
    openingBalance: opening.solde,
    closingBalance: closing.solde,
    transactions: transactions.map(toEmailTransaction),
  };
}

/** Relevé du mois civil précédent (utilisé par le cron mensuel). */
export async function buildPreviousMonthStatement(now = new Date()): Promise<Statement & { periodStart: Date }> {
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(periodStart);

  const [opening, closing, transactions] = await Promise.all([
    getSoldeAt(periodStart),
    getSoldeAt(periodEnd),
    prisma.transaction.findMany({
      where: { date: { gte: periodStart, lt: periodEnd } },
      orderBy: { date: "asc" },
    }),
  ]);

  return {
    title: "Relevé de compte",
    subtitle: `Mois de ${monthLabel}`,
    filename: `releve-${periodStart.toISOString().slice(0, 7)}.pdf`,
    openingBalance: opening.solde,
    closingBalance: closing.solde,
    transactions: transactions.map(toEmailTransaction),
    periodStart,
  };
}

function toEmailTransaction(t: {
  date: Date;
  montant: { toString(): string } | number;
  type: "CREDIT" | "DEBIT";
  motif: string | null;
}): EmailTransaction {
  return { date: t.date, montant: Number(t.montant), type: t.type, motif: t.motif };
}
