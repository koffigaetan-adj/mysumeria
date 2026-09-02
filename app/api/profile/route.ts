import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Préférences d'alertes de l'utilisateur connecté (route protégée par le middleware).
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const KEYS = ["notifyOnTransaction", "pushOnTransaction", "monthlyStatement", "notifyOnLogin", "pushOnLogin"] as const;
  const data: Partial<Record<(typeof KEYS)[number], boolean>> = {};
  for (const key of KEYS) {
    if (typeof body[key] === "boolean") data[key] = body[key];
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data,
    select: { notifyOnTransaction: true, pushOnTransaction: true, monthlyStatement: true, notifyOnLogin: true, pushOnLogin: true },
  });
  return NextResponse.json(user);
}
