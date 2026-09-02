import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { buildPreviousMonthStatement } from "@/lib/statement";
import { sendStatementEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Même règle d'accès que /api/sync-emails : session valide OU secret cron.
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
    const recipients = (
      await prisma.user.findMany({ where: { monthlyStatement: true }, select: { email: true } })
    ).map((u) => u.email);

    const statement = await buildPreviousMonthStatement();
    const result = recipients.length > 0 ? await sendStatementEmail(recipients, statement) : { ok: true as const };

    return NextResponse.json({
      periodStart: statement.periodStart.toISOString(),
      openingBalance: statement.openingBalance,
      closingBalance: statement.closingBalance,
      transactionCount: statement.transactions.length,
      recipients,
      sent: result.ok,
      error: result.ok ? undefined : result.error,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[monthly-statement] Échec de l'envoi du relevé:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET : utilisé par Vercel Cron (1er de chaque mois). POST : déclenchement manuel.
export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
