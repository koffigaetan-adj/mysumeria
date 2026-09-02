import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getMonthStats, getSoldeCourant } from "@/lib/balance";
import { getChartData } from "@/lib/charts";
import { categorize } from "@/lib/categories";
import { type Periode, parsePeriode, periodeStart } from "@/lib/period";
import { getSession } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import { SyncProvider } from "@/app/components/SyncProvider";
import PullToRefresh from "@/app/components/PullToRefresh";
import BalanceCard from "@/app/components/BalanceCard";
import BalanceChart from "@/app/components/BalanceChart";
import CategoryBars from "@/app/components/CategoryBars";
import SearchBox from "@/app/components/SearchBox";
import Menu from "@/app/components/Menu";
import TransactionItem from "@/app/components/TransactionItem";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const FILTRES: Array<{ key: Periode; label: string }> = [
  { key: "mois", label: "Ce mois-ci" },
  { key: "30j", label: "30 jours" },
  { key: "tout", label: "Tout" },
];

function filterHref(periode: Periode, q: string, view: string): string {
  const params = new URLSearchParams();
  if (periode !== "mois") params.set("periode", periode);
  if (q) params.set("q", q);
  if (view === "graphiques") params.set("vue", "graphiques");
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; q?: string; vue?: string }>;
}) {
  const params = await searchParams;
  const periode = parsePeriode(params.periode);
  const q = (params.q ?? "").trim();
  const view = params.vue === "graphiques" ? "graphiques" : "liste";
  const start = periodeStart(periode);

  const [session, { solde, configured }, stats, transactions, unparsedCount, charts] = await Promise.all([
    getSession(),
    getSoldeCourant(),
    getMonthStats(),
    prisma.transaction.findMany({
      where: {
        ...(start ? { date: { gte: start } } : {}),
        ...(q
          ? {
              OR: [
                { motif: { contains: q, mode: "insensitive" } },
                { label: { contains: q, mode: "insensitive" } },
                { note: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.unparsedEmail.count(),
    view === "graphiques" ? getChartData() : Promise.resolve(null),
  ]);

  const accountName = process.env.BANK_ACCOUNT_NAME;
  const isAdmin = isAdminEmail(session?.email);

  return (
    <SyncProvider>
      <PullToRefresh>
        <main className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-4 md:max-w-2xl">
          <header className="flex items-center justify-between py-4">
            <div>
              <h1 className="font-display text-3xl leading-none">My Sumeria</h1>
              {accountName && <p className="mt-1 text-xs text-ink-900/50 dark:text-white/50">{accountName}</p>}
            </div>
            <Menu periode={periode} isAdmin={isAdmin} />
          </header>

          <BalanceCard soldeEur={solde} configured={configured} stats={stats} />

          {/* Liste / Graphiques */}
          <nav className="mt-5 flex gap-1 rounded-full bg-white p-1 dark:bg-ink-800">
            {(["liste", "graphiques"] as const).map((v) => (
              <Link
                key={v}
                href={filterHref(periode, q, v)}
                className={`flex-1 rounded-full py-2 text-center text-sm font-medium transition ${
                  view === v ? "bg-brand-700 text-white dark:bg-brand-500" : "text-ink-900/60 hover:bg-brand-100 dark:text-white/60 dark:hover:bg-ink-700"
                }`}
              >
                {v === "liste" ? "Transactions" : "Graphiques"}
              </Link>
            ))}
          </nav>

          {view === "graphiques" && charts ? (
            <section data-scroll-region className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pb-6">
              <BalanceChart daily={charts.daily} monthly={charts.monthly} />
              <CategoryBars categories={charts.categories} total={charts.monthDebits} />
            </section>
          ) : (
            <>
              <nav className="mt-4 flex gap-2">
                {FILTRES.map((f) => (
                  <Link
                    key={f.key}
                    href={filterHref(f.key, q, view)}
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

              {/* Seule zone défilante : le solde, les onglets et les filtres restent visibles */}
              <section data-scroll-region className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pb-6">
                {transactions.length === 0 ? (
                  <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-ink-900/50 dark:bg-ink-800 dark:text-white/50">
                    {q ? `Aucune transaction ne contient « ${q} ».` : "Aucune transaction sur cette période."}
                  </p>
                ) : (
                  transactions.map((t) => (
                    <TransactionItem
                      key={t.id}
                      t={{
                        id: t.id,
                        dateLabel: DATE_FMT.format(t.date),
                        montant: Number(t.montant),
                        type: t.type,
                        motif: t.motif,
                        label: t.label,
                        note: t.note,
                        category: t.category,
                        autoCategory: categorize(t.label ?? t.motif, null),
                      }}
                    />
                  ))
                )}
              </section>
            </>
          )}

          {isAdmin && unparsedCount > 0 && (
            <footer className="shrink-0 py-2 text-center text-xs text-ink-900/40 dark:text-white/40">
              {unparsedCount} email{unparsedCount > 1 ? "s" : ""} ignoré{unparsedCount > 1 ? "s" : ""} par le parseur —{" "}
              <Link href="/parametres/emails" className="underline">
                voir
              </Link>
              .
            </footer>
          )}
        </main>
      </PullToRefresh>
    </SyncProvider>
  );
}
