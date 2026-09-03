import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import { retryUnparsedEmails } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Repasse le parseur (mis à jour) sur les emails ignorés. Réservé à l'administrateur.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isAdminEmail(session.email)) return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });

  return NextResponse.json(await retryUnparsedEmails());
}
