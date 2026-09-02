import { prisma } from "@/lib/prisma";
import { getGmailClient, extractBody, getHeader } from "@/lib/gmail";
import { parseBankEmail, isTargetAccount, describeNonTransactionAlert } from "@/lib/parseBankEmail";
import { getSoldeCourant } from "@/lib/balance";
import { sendTransactionNotification, type EmailTransaction } from "@/lib/email";
import { sendPushToUsers } from "@/lib/push";

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const MAX_MESSAGES_PER_SYNC = 50;
// On renouvelle l'abonnement Gmail (valable 7 jours) dès qu'il reste moins de 2 jours.
const WATCH_RENEW_BEFORE_MS = 2 * 24 * 60 * 60 * 1000;

export type SyncResult = {
  totalMatchingFilter: number;
  alreadyKnown: number;
  processed: number;
  transactionsCreated: number;
  storedAsUnparsed: number;
  errors: string[];
  preview: Array<{ id: string; date: string; from: string; subject: string; snippet: string }>;
};

/**
 * Lit les nouveaux emails d'alerte, crée les transactions, envoie mails + push.
 * Appelée par le bouton du dashboard, la synchro auto de l'appli, le cron,
 * et la notification instantanée Gmail (Pub/Sub).
 */
export async function syncEmails(): Promise<SyncResult> {
  const sender = process.env.BANK_ALERT_SENDER;
  if (!sender) {
    throw new Error("BANK_ALERT_SENDER manquant dans les variables d'environnement");
  }

  const gmail = getGmailClient();

  const list = await gmail.users.messages.list({
    userId: "me",
    q: `from:${sender}`,
    maxResults: MAX_MESSAGES_PER_SYNC,
  });
  const messageIds = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);

  // Déduplication : on ignore tout ce qu'on connaît déjà (transactions ET emails non parsés)
  const [knownTransactions, knownUnparsed] = await Promise.all([
    prisma.transaction.findMany({
      where: { sourceEmailId: { in: messageIds } },
      select: { sourceEmailId: true },
    }),
    prisma.unparsedEmail.findMany({
      where: { sourceEmailId: { in: messageIds } },
      select: { sourceEmailId: true },
    }),
  ]);
  const knownIds = new Set([
    ...knownTransactions.map((t) => t.sourceEmailId),
    ...knownUnparsed.map((u) => u.sourceEmailId),
  ]);
  const newIds = messageIds.filter((id) => !knownIds.has(id));

  let created = 0;
  let unparsed = 0;
  const errors: string[] = [];
  const notifiable: EmailTransaction[] = [];
  const preview: SyncResult["preview"] = [];

  for (const id of newIds) {
    try {
      const { data: message } = await gmail.users.messages.get({ userId: "me", id, format: "full" });

      const subject = getHeader(message, "Subject");
      const from = getHeader(message, "From");
      const receivedAt = message.internalDate ? new Date(Number(message.internalDate)) : new Date();
      const snippet = message.snippet ?? "";
      const body = extractBody(message.payload);

      if (preview.length < 10) {
        preview.push({ id, date: receivedAt.toISOString(), from, subject, snippet });
      }

      const targetAccount = process.env.BANK_ACCOUNT_NAME;
      const parsed = parseBankEmail(subject, body, receivedAt, targetAccount);

      if (parsed && isTargetAccount(parsed.compteName, targetAccount)) {
        await prisma.transaction.create({
          data: {
            date: parsed.date,
            montant: parsed.montant,
            type: parsed.type,
            motif: parsed.motif,
            sourceEmailId: id,
            rawEmailSnippet: snippet,
          },
        });
        created++;
        notifiable.push({ date: parsed.date, montant: parsed.montant, type: parsed.type, motif: parsed.motif });
      } else {
        const reason = !parsed
          ? (describeNonTransactionAlert(subject, body) ?? "Email non reconnu par le parseur")
          : !parsed.compteName
            ? "Compte non détecté dans l'email"
            : `Transaction sur un autre compte : « ${parsed.compteName} »`;
        console.warn(`[sync] Email ignoré (${id}) : "${subject}" — ${reason}`);
        await prisma.unparsedEmail.create({
          data: {
            sourceEmailId: id,
            fromAddress: from,
            subject,
            snippet,
            body: body.slice(0, 20000),
            reason,
            receivedAt,
          },
        });
        unparsed++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[sync] Erreur sur le message ${id}:`, e);
      errors.push(`${id}: ${msg}`);
    }
  }

  if (notifiable.length > 0) {
    const [{ solde }, users] = await Promise.all([
      getSoldeCourant(),
      prisma.user.findMany({ where: { notifyOnTransaction: true }, select: { id: true, email: true } }),
    ]);
    const first = notifiable[0];
    await Promise.all([
      sendTransactionNotification(
        users.map((u) => u.email),
        notifiable,
        solde
      ),
      sendPushToUsers(
        users.map((u) => u.id),
        {
          title:
            notifiable.length === 1
              ? `${first.type === "CREDIT" ? "+" : "−"}${EUR.format(first.montant)} · ${first.motif ?? "Mouvement"}`
              : `${notifiable.length} nouveaux mouvements`,
          body: `Nouveau solde : ${EUR.format(solde)}`,
          url: "/",
          tag: "transactions",
        }
      ),
    ]);
  }

  await ensureGmailWatch();

  return {
    totalMatchingFilter: messageIds.length,
    alreadyKnown: knownIds.size,
    processed: newIds.length,
    transactionsCreated: created,
    storedAsUnparsed: unparsed,
    errors,
    preview,
  };
}

/** Vrai si la détection instantanée (Gmail → Pub/Sub → /api/gmail/push) est configurée. */
export function isInstantSyncConfigured(): boolean {
  return Boolean(process.env.GMAIL_PUBSUB_TOPIC);
}

/** (Ré)abonne la boîte Gmail aux notifications Pub/Sub. Valable 7 jours. */
export async function renewGmailWatch(): Promise<Date | null> {
  const topicName = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topicName) return null;

  const gmail = getGmailClient();
  const { data } = await gmail.users.watch({ userId: "me", requestBody: { topicName } });
  const expiration = data.expiration ? new Date(Number(data.expiration)) : null;

  if (expiration) {
    await prisma.accountConfig.updateMany({ where: { id: 1 }, data: { gmailWatchExpiration: expiration } });
  }
  return expiration;
}

/** Renouvelle l'abonnement Gmail s'il expire bientôt. Ne fait jamais échouer la synchro. */
export async function ensureGmailWatch(): Promise<void> {
  if (!isInstantSyncConfigured()) return;
  try {
    const config = await prisma.accountConfig.findUnique({ where: { id: 1 }, select: { gmailWatchExpiration: true } });
    const expiration = config?.gmailWatchExpiration;
    if (expiration && expiration.getTime() - Date.now() > WATCH_RENEW_BEFORE_MS) return;
    const renewed = await renewGmailWatch();
    console.info(`[gmail-watch] Abonnement renouvelé jusqu'au ${renewed?.toISOString()}`);
  } catch (e) {
    console.error("[gmail-watch] Renouvellement impossible :", e);
  }
}
