import { prisma } from "@/lib/prisma";
import { getAdminEmails } from "@/lib/admin";
import { isEmailConfigured, sendAdminAlert } from "@/lib/email";

const MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Prévient l'administrateur d'un problème technique, au plus une fois par 24 h
 * (une panne durable ne doit pas générer un mail par tentative). Ne lève jamais.
 */
export async function reportHealthIssue(subject: string, detail: string): Promise<void> {
  console.error(`[health] ${subject} — ${detail}`);
  try {
    if (!isEmailConfigured()) return;
    const admins = getAdminEmails();
    if (admins.length === 0) return;

    const config = await prisma.accountConfig.findUnique({ where: { id: 1 }, select: { lastHealthAlertAt: true } });
    const last = config?.lastHealthAlertAt?.getTime() ?? 0;
    if (Date.now() - last < MIN_INTERVAL_MS) return;

    const result = await sendAdminAlert(admins, subject, detail);
    if (result.ok) {
      await prisma.accountConfig.updateMany({ where: { id: 1 }, data: { lastHealthAlertAt: new Date() } });
    }
  } catch (e) {
    console.error("[health] Impossible d'envoyer l'alerte :", e);
  }
}

/** Enregistre qu'une synchronisation a réussi (sert à repérer un blocage durable). */
export async function markSyncSuccess(): Promise<void> {
  await prisma.accountConfig.updateMany({ where: { id: 1 }, data: { lastSyncAt: new Date() } }).catch(() => {});
}
