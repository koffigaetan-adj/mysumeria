import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Liste / suppression des clés Face ID / empreinte de l'utilisateur connecté.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const passkeys = await prisma.passkey.findMany({
    where: { userId: session.userId },
    select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ passkeys });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await request.json().catch(() => ({}));
  if (typeof id !== "string") return NextResponse.json({ error: "id manquant" }, { status: 400 });

  await prisma.passkey.deleteMany({ where: { id, userId: session.userId } });
  return NextResponse.json({ ok: true });
}
