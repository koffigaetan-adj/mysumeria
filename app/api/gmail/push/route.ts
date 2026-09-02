import { NextRequest, NextResponse, after } from "next/server";
import { syncEmails } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Webhook appelé par Google Pub/Sub à chaque nouveau mail dans la boîte Gmail
// (abonnement créé par users.watch, voir lib/sync.ts). L'URL de l'abonnement
// porte ?token=CRON_SECRET pour n'accepter que les appels de Google.
// On répond 200 tout de suite (sinon Pub/Sub réessaie) et on synchronise après.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.nextUrl.searchParams.get("token") !== secret) {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  // Le corps contient { message: { data: base64({emailAddress, historyId}) } } ;
  // on n'en a pas besoin : la synchro relit simplement les derniers mails de la banque.
  await request.json().catch(() => null);

  after(async () => {
    try {
      const result = await syncEmails();
      console.info(`[gmail-push] Synchro : ${result.transactionsCreated} transaction(s), ${result.storedAsUnparsed} ignoré(s)`);
    } catch (e) {
      console.error("[gmail-push] Échec de la synchronisation :", e);
    }
  });

  return NextResponse.json({ ok: true });
}
