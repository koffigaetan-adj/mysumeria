import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getGmailClient, extractBody, getHeader } from "@/lib/gmail";
import { parseBankEmail, isTargetAccount } from "@/lib/parseBankEmail";
import { getSoldeCourant } from "@/lib/balance";
import { sendTransactionNotification, type EmailTransaction } from "@/lib/email";
import { sendPushToUsers } from "@/lib/push";

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGES_PER_SYNC = 50;

// Cette route est hors middleware : elle gère sa propre auth.
// Accès autorisé si session valide (bouton du dashboard) OU secret cron (Vercel Cron).
async function isAuthorized(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) {
    return true;
  }
  return Boolean(await getSession());
}

async function syncEmails() {
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
  // Aperçu renvoyé au client pour vérifier que le filtre Gmail fonctionne
  const preview: Array<{ id: string; date: string; from: string; subject: string; snippet: string }> = [];

  for (const id of newIds) {
    try {
      const { data: message } = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "full",
      });

      const subject = getHeader(message, "Subject");
      const from = getHeader(message, "From");
      const receivedAt = message.internalDate
        ? new Date(Number(message.internalDate))
        : new Date();
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
        notifiable.push({
          date: parsed.date,
          montant: parsed.montant,
          type: parsed.type,
          motif: parsed.motif,
        });
      } else {
        const reason = !parsed
          ? "Email non reconnu par le parseur"
          : !parsed.compteName
            ? "Compte non détecté dans l'email"
            : `Transaction sur un autre compte : « ${parsed.compteName} »`;
        console.warn(`[sync-emails] Email ignoré (${id}) : "${subject}" — ${reason}`);
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
      console.error(`[sync-emails] Erreur sur le message ${id}:`, e);
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

async function handle(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  try {
    const result = await syncEmails();
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sync-emails] Échec de la synchronisation:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET : utilisé par Vercel Cron. POST : utilisé par le bouton du dashboard.
export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
