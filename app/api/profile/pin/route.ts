import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Changement de code (6 ou 8 chiffres) après vérification du code actuel.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { currentPin, newPin } = await request.json().catch(() => ({}));
  if (typeof currentPin !== "string" || typeof newPin !== "string" || !/^(\d{6}|\d{8})$/.test(newPin)) {
    return NextResponse.json({ error: "Le nouveau code doit faire 6 ou 8 chiffres." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  const valid = await bcrypt.compare(currentPin, user.pinHash);
  if (!valid) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return NextResponse.json({ error: "Code actuel incorrect." }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { pinHash: await bcrypt.hash(newPin, 10), pinLength: newPin.length, failedAttempts: 0, lockedUntil: null },
  });
  return NextResponse.json({ ok: true, pinLength: newPin.length });
}
