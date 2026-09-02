import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isEmailConfigured, sendPasswordResetEmail } from "@/lib/email";
import { getRelyingParty } from "@/lib/webauthn";

const TOKEN_TTL_MS = 30 * 60 * 1000;
const MIN_INTERVAL_MS = 2 * 60 * 1000; // pas plus d'un mail toutes les 2 min par compte

// "Code oublié" : envoie un lien de réinitialisation. Répond toujours OK, que
// l'adresse existe ou non, pour ne pas révéler les comptes.
export async function POST(request: NextRequest) {
  const { email } = await request.json().catch(() => ({}));
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ ok: true });
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !isEmailConfigured()) return NextResponse.json({ ok: true });

  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - MIN_INTERVAL_MS) } },
  });
  if (recent) return NextResponse.json({ ok: true });

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });

  const { origin } = getRelyingParty(request);
  const result = await sendPasswordResetEmail(user.email, `${origin}/reinitialiser?token=${token}`, user.firstName);
  if (!result.ok) console.error("[auth/forgot] Envoi impossible :", result.error);

  return NextResponse.json({ ok: true });
}
