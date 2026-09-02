import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import { ArrowLeftIcon } from "@/app/components/Icons";
import RetryParsingButton from "@/app/components/RetryParsingButton";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function EmailsIgnoresPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminEmail(session.email)) redirect("/parametres");

  const emails = await prisma.unparsedEmail.findMany({
    orderBy: { receivedAt: "desc" },
    take: 100,
    select: { id: true, subject: true, snippet: true, reason: true, receivedAt: true, body: true },
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10 md:max-w-2xl">
      <header className="flex items-center gap-3 py-4">
        <Link
          href="/parametres"
          aria-label="Retour"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-900/10 transition hover:bg-ink-900/15 dark:bg-white/15 dark:hover:bg-white/25"
        >
          <ArrowLeftIcon />
        </Link>
        <div>
          <h1 className="font-display text-3xl leading-none">Emails ignorés</h1>
          <p className="mt-1 text-xs text-ink-900/50 dark:text-white/50">
            {emails.length === 0 ? "Aucun" : `${emails.length} email${emails.length > 1 ? "s" : ""}`} non transformé{emails.length > 1 ? "s" : ""} en transaction
          </p>
        </div>
      </header>

      <RetryParsingButton disabled={emails.length === 0} />

      <p className="mt-3 text-xs text-ink-900/50 dark:text-white/50">
        Un email arrive ici quand le parseur ne reconnaît pas son format, ou quand la transaction concerne un autre compte
        que celui suivi. Copie le texte d&apos;un email non reconnu à Claude pour ajouter le format au parseur, puis « Réessayer ».
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {emails.map((e) => (
          <li key={e.id} className="rounded-2xl bg-white p-4 dark:bg-ink-800">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium">{e.subject || "(sans sujet)"}</p>
              <p className="shrink-0 text-xs text-ink-900/50 dark:text-white/50">{DATE_FMT.format(e.receivedAt)}</p>
            </div>
            <p className="mt-1 inline-block rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
              {e.reason ?? "Non reconnu"}
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-ink-900/60 dark:text-white/60">Voir le texte</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-ink-900/5 p-3 text-[11px] leading-relaxed dark:bg-white/5">
                {e.body.slice(0, 4000)}
              </pre>
            </details>
          </li>
        ))}
      </ul>
    </main>
  );
}
