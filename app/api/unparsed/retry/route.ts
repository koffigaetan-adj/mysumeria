import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { parseBankEmail, isTargetAccount, describeNonTransactionAlert } from "@/lib/parseBankEmail";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Repasse le parseur (mis à jour) sur les emails ignorés : ceux qui sont
// maintenant reconnus deviennent des transactions et quittent la liste.
// Réservé à l'administrateur.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isAdminEmail(session.email)) return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });

  const targetAccount = process.env.BANK_ACCOUNT_NAME;
  const emails = await prisma.unparsedEmail.findMany({ orderBy: { receivedAt: "asc" } });

  let converted = 0;
  for (const email of emails) {
    const parsed = parseBankEmail(email.subject, email.body, email.receivedAt, targetAccount);
    const reason = !parsed
      ? (describeNonTransactionAlert(email.subject, email.body) ?? "Email non reconnu par le parseur")
      : !parsed.compteName
        ? "Compte non détecté dans l'email"
        : !isTargetAccount(parsed.compteName, targetAccount)
          ? `Transaction sur un autre compte : « ${parsed.compteName} »`
          : null;

    if (parsed && reason === null) {
      await prisma.$transaction([
        prisma.transaction.create({
          data: {
            date: parsed.date,
            montant: parsed.montant,
            type: parsed.type,
            motif: parsed.motif,
            sourceEmailId: email.sourceEmailId,
            rawEmailSnippet: email.snippet,
          },
        }),
        prisma.unparsedEmail.delete({ where: { id: email.id } }),
      ]);
      converted++;
    } else if (reason !== email.reason) {
      await prisma.unparsedEmail.update({ where: { id: email.id }, data: { reason } });
    }
  }

  return NextResponse.json({ total: emails.length, converted, remaining: emails.length - converted });
}
