import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { parsePeriode } from "@/lib/period";
import { buildPeriodStatement } from "@/lib/statement";
import { sendStatementEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Envoie à l'utilisateur connecté le relevé (PDF joint) de la période demandée.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const statement = await buildPeriodStatement(parsePeriode(body.periode));
  const result = await sendStatementEmail([session.email], statement);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, to: session.email });
}
