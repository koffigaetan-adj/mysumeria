import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getMonthStats, getSoldeCourant } from "@/lib/balance";
import { type Periode, parsePeriode, periodeStart } from "@/lib/period";
import { SyncProvider } from "@/app/components/SyncProvider";
import PullToRefresh from "@/app/components/PullToRefresh";
import BalanceCard from "@/app/components/BalanceCard";
import SearchBox from "@/app/components/SearchBox";
import Menu from "@/app/components/Menu";
import { ArrowDownLeftIcon, ArrowUpRightIcon } from "@/app/components/Icons";

export const dynamic = "force-dynamic";

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const FILTRES: Array<{ key: Periode; label: string }> = [
  { key: "mois", label: "Ce mois-ci" },
  { key: "30j", label: "30 jours" },
  { key: "tout", label: "Tout" },
];

function filterHref(periode: Periode, q: string): string {
  const params = new URLSearchParams();
  if (periode !== "mois") params.set("periode", periode);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; q?: string }>;
}) {
  const params = await searchParams;
  const periode = parsePeriode(params.periode);
  const q = (params.q ?? "").trim();
  const start = periodeStart(periode);

  const [{ solde, configured }, stats, transactions, unparsedCount] = await Promise.all([
    getSoldeCourant(),
    getMonthStats(),
    prisma.transaction.findMany({
      where: {
        ...(start ? { date: { gte: start } } : {}),
        ...(q ? { motif: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.unparsedEmail.count(),
  ]);

  const accountName = process.env.BANK_ACCOUNT_NAME;

  return (
    <SyncProvider>
      <PullToRefresh>
        <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 md:max-w-2xl">
          <header className="flex items-center justify-between py-4">
            <div>
              <h1 className="font-display text-3xl leading-none">My Sumeria</h1>
              {accountName && <p className="mt-1 text-xs text-ink-900/50 dark:text-white/50">{accountName}</p>}
            </div>
            <Menu periode={periode} />
          </header>

          <BalanceCard soldeEur={solde} configured={configured} stats={stats} />

          <nav className="mt-5 flex gap-2">
            {FILTRES.map((f) => (
              <Link
                key={f.key}
                href={filterHref(f.key, q)}
                className={`flex-1 rounded-full py-2 text-center text-sm font-medium transition ${
                  periode === f.key
                    ? "bg-brand-700 text-white dark:bg-brand-500"
                    : "bg-white text-ink-900/70 hover:bg-brand-100 dark:bg-ink-800 dark:text-white/70 dark:hover:bg-ink-700"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </nav>

          <div className="mt-3">
            <SearchBox periode={periode} initialQuery={q} />
          </div>

          <section className="mt-4 flex flex-col gap-2">
            {transactions.length === 0 ? (
              <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-ink-900/50 dark:bg-ink-800 dark:text-white/50">
                {q ? `Aucun motif ne contient « ${q} ».` : "Aucune transaction sur cette période."}
              </p>
            ) : (
              transactions.map((t) => (
                <article
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-ink-800"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm ${
                        t.type === "CREDIT"
                          ? "bg-brand-500/15 text-brand-700 dark:text-brand-200"
                          : "bg-red-500/10 text-red-600 dark:text-red-300"
                      }`}
                    >
                      {t.type === "CREDIT" ? <ArrowDownLeftIcon className="h-4 w-4" /> : <ArrowUpRightIcon className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.motif ?? "Motif inconnu"}</p>
                      <p className="text-xs text-ink-900/50 dark:text-white/50">{DATE_FMT.format(t.date)}</p>
                    </div>
                  </div>
                  <p
                    className={`shrink-0 text-base font-semibold tabular-nums ${
                      t.type === "CREDIT" ? "text-brand-700 dark:text-brand-200" : "text-red-600 dark:text-red-300"
                    }`}
                  >
                    {t.type === "CREDIT" ? "+" : "−"}
                    {EUR.format(Number(t.montant))}
                  </p>
                </article>
              ))
            )}
          </section>

          {unparsedCount > 0 && (
            <footer className="mt-auto pt-8 text-center text-xs text-ink-900/40 dark:text-white/40">
              {unparsedCount} email{unparsedCount > 1 ? "s" : ""} ignoré{unparsedCount > 1 ? "s" : ""} par le parseur
              (voir <Link href="/parametres" className="underline">Paramètres</Link>).
            </footer>
          )}
        </main>
      </PullToRefresh>
    </SyncProvider>
  );
}
