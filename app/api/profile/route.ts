import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Préférences d'alertes de l'utilisateur connecté (route protégée par le middleware).
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const KEYS = ["notifyOnTransaction", "pushOnTransaction", "monthlyStatement", "notifyOnLogin", "pushOnLogin"] as const;
  const data: Partial<Record<(typeof KEYS)[number], boolean>> & {
    firstName?: string | null;
    lastName?: string | null;
    avatarDataUrl?: string | null;
  } = {};
  for (const key of KEYS) {
    if (typeof body[key] === "boolean") data[key] = body[key];
  }

  // Profil : prénom / nom (texte court) et photo (data URL JPEG/PNG/WebP redimensionnée côté client)
  for (const key of ["firstName", "lastName"] as const) {
    if (body[key] === null) data[key] = null;
    else if (typeof body[key] === "string") data[key] = body[key].trim().slice(0, 40) || null;
  }
  if (body.avatarDataUrl === null) data.avatarDataUrl = null;
  else if (typeof body.avatarDataUrl === "string") {
    const ok = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(body.avatarDataUrl) && body.avatarDataUrl.length <= 300_000;
    if (!ok) return NextResponse.json({ error: "Photo invalide ou trop lourde." }, { status: 400 });
    data.avatarDataUrl = body.avatarDataUrl;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data,
    select: {
      notifyOnTransaction: true,
      pushOnTransaction: true,
      monthlyStatement: true,
      notifyOnLogin: true,
      pushOnLogin: true,
      firstName: true,
      lastName: true,
    },
  });
  return NextResponse.json(user);
}
