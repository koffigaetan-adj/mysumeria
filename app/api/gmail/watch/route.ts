import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import { isInstantSyncConfigured, renewGmailWatch } from "@/lib/sync";

export const dynamic = "force-dynamic";

// (Ré)active la détection instantanée : abonne la boîte Gmail au topic Pub/Sub.
// Réservé à l'administrateur (ou au secret cron). Renouvelé ensuite automatiquement.
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const viaCron = Boolean(cronSecret) && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (!viaCron) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!isAdminEmail(session.email)) return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
  }

  if (!isInstantSyncConfigured()) {
    return NextResponse.json({ error: "GMAIL_PUBSUB_TOPIC n'est pas configuré (voir README)." }, { status: 400 });
  }

  try {
    const expiration = await renewGmailWatch();
    return NextResponse.json({ ok: true, expiration: expiration?.toISOString() ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[gmail/watch] Échec :", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
