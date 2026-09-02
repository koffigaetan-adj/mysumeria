import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { syncEmails } from "@/lib/sync";
import { reportHealthIssue } from "@/lib/health";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cette route est hors middleware : elle gère sa propre auth.
// Accès autorisé si session valide (bouton du dashboard) OU secret cron (Vercel Cron / cron externe).
async function isAuthorized(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) {
    return true;
  }
  return Boolean(await getSession());
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
    await reportHealthIssue("Synchronisation Gmail en échec", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET : utilisé par les crons. POST : utilisé par le dashboard.
export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
