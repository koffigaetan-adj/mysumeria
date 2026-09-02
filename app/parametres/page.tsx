import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isEmailConfigured } from "@/lib/email";
import { isAdminEmail } from "@/lib/admin";
import { isInstantSyncConfigured } from "@/lib/sync";
import SettingsForm from "@/app/components/SettingsForm";
import { ArrowLeftIcon } from "@/app/components/Icons";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user, unparsedCount, config] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        email: true,
        pinLength: true,
        notifyOnTransaction: true,
        pushOnTransaction: true,
        monthlyStatement: true,
        notifyOnLogin: true,
        pushOnLogin: true,
      },
    }),
    prisma.unparsedEmail.count(),
    prisma.accountConfig.findUnique({ where: { id: 1 }, select: { gmailWatchExpiration: true } }),
  ]);
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10 md:max-w-2xl">
      <header className="flex items-center gap-3 py-4">
        <Link
          href="/"
          aria-label="Retour"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-900/10 transition hover:bg-ink-900/15 dark:bg-white/15 dark:hover:bg-white/25"
        >
          <ArrowLeftIcon />
        </Link>
        <h1 className="font-display text-3xl leading-none">Paramètres</h1>
      </header>

      <SettingsForm
        user={user}
        emailsConfigured={isEmailConfigured()}
        unparsedCount={unparsedCount}
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null}
        isAdmin={isAdminEmail(session.email)}
        instantSync={{
          configured: isInstantSyncConfigured(),
          expiration: config?.gmailWatchExpiration?.toISOString() ?? null,
        }}
      />
    </main>
  );
}
