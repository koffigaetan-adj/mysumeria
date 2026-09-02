import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Enregistre (POST) ou retire (DELETE) l'abonnement push du navigateur courant.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { subscription } = await request.json().catch(() => ({}));
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "Abonnement invalide" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: session.userId, p256dh, auth, userAgent: request.headers.get("user-agent") },
    create: { userId: session.userId, endpoint, p256dh, auth, userAgent: request.headers.get("user-agent") },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { endpoint } = await request.json().catch(() => ({}));
  if (typeof endpoint !== "string") return NextResponse.json({ error: "endpoint manquant" }, { status: 400 });

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.userId } });
  return NextResponse.json({ ok: true });
}
