import { NextRequest, NextResponse, after } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { getLoginContext } from "@/lib/loginContext";
import { isEmailConfigured, sendLoginAlert } from "@/lib/email";

// Hash bidon comparé quand l'email est inconnu, pour que la durée de réponse
// ne révèle pas si l'email existe.
const DUMMY_HASH = "$2b$10$C6UzMDM.H6dfI/f/IKcEeO7ZDzE1V8mDqQyV0jY0eWZlXK1a2b3cO";

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function minutesLeft(lockedUntil: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60000));
}

export async function POST(request: NextRequest) {
  const { email, pin } = await request.json().catch(() => ({}));

  if (typeof email !== "string" || typeof pin !== "string" || !/^(\d{6}|\d{8})$/.test(pin)) {
    return NextResponse.json({ error: "Email ou code invalide" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    return NextResponse.json(
      { error: `Compte temporairement bloqué. Réessaie dans ${minutesLeft(user.lockedUntil)} min.` },
      { status: 423 }
    );
  }

  const valid = await bcrypt.compare(pin, user?.pinHash ?? DUMMY_HASH);

  if (!user || !valid) {
    // Petit délai pour freiner le brute force (suffisant pour un projet à 2 utilisateurs)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (user) {
      const failedAttempts = user.failedAttempts + 1;
      const lockOut = failedAttempts >= MAX_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: lockOut ? 0 : failedAttempts,
          lockedUntil: lockOut ? new Date(Date.now() + LOCK_DURATION_MS) : null,
        },
      });
      if (lockOut) {
        return NextResponse.json(
          { error: `Trop de tentatives. Compte bloqué ${LOCK_DURATION_MS / 60000} min.` },
          { status: 423 }
        );
      }
    }

    return NextResponse.json({ error: "Email ou code invalide" }, { status: 401 });
  }

  if (user.failedAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });
  }

  await createSession({ userId: user.id, email: user.email });

  // Alerte envoyée après la réponse pour ne pas ralentir la connexion.
  if (user.notifyOnLogin && isEmailConfigured()) {
    const ctx = getLoginContext(request);
    after(() => sendLoginAlert(user.email, ctx));
  }

  return NextResponse.json({ ok: true });
}
