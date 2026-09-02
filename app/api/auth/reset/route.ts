import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Définit un nouveau code à partir d'un lien de réinitialisation valide.
export async function POST(request: NextRequest) {
  const { token, newPin } = await request.json().catch(() => ({}));
  if (typeof token !== "string" || typeof newPin !== "string" || !/^(\d{6}|\d{8})$/.test(newPin)) {
    return NextResponse.json({ error: "Lien ou code invalide." }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } });

  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return NextResponse.json({ error: "Ce lien est expiré ou a déjà été utilisé. Refais une demande depuis la page de connexion." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { pinHash: await bcrypt.hash(newPin, 10), pinLength: newPin.length, failedAttempts: 0, lockedUntil: null },
    }),
    prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    // Invalide les autres liens encore en circulation pour ce compte
    prisma.passwordResetToken.deleteMany({ where: { userId: reset.userId, id: { not: reset.id }, usedAt: null } }),
  ]);

  return NextResponse.json({ ok: true, email: reset.user.email, pinLength: newPin.length });
}
