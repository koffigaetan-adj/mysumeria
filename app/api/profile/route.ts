import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Préférences d'alertes de l'utilisateur connecté (route protégée par le middleware).
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const data: { notifyOnTransaction?: boolean; monthlyStatement?: boolean; notifyOnLogin?: boolean } = {};
  if (typeof body.notifyOnTransaction === "boolean") data.notifyOnTransaction = body.notifyOnTransaction;
  if (typeof body.monthlyStatement === "boolean") data.monthlyStatement = body.monthlyStatement;
  if (typeof body.notifyOnLogin === "boolean") data.notifyOnLogin = body.notifyOnLogin;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data,
    select: { notifyOnTransaction: true, monthlyStatement: true, notifyOnLogin: true },
  });
  return NextResponse.json(user);
}
