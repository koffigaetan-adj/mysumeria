import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_PIN_LENGTH = 8;

// Renvoie le nombre de cases à afficher pour cet email. Pour un email inconnu
// on renvoie la valeur par défaut, sans dire si le compte existe.
export async function POST(request: NextRequest) {
  const { email } = await request.json().catch(() => ({}));
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ pinLength: DEFAULT_PIN_LENGTH });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { pinLength: true },
  });

  return NextResponse.json({ pinLength: user?.pinLength ?? DEFAULT_PIN_LENGTH });
}
