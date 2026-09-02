import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getRelyingParty, RP_NAME, storeChallenge } from "@/lib/webauthn";

// Étape 1 de l'enregistrement d'une clé (Face ID / empreinte) : options pour le navigateur.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const existing = await prisma.passkey.findMany({
    where: { userId: session.userId },
    select: { credentialId: true, transports: true },
  });
  const { rpID } = getRelyingParty(request);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: session.email,
    userID: new TextEncoder().encode(session.userId),
    userDisplayName: session.email,
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });

  await storeChallenge(options.challenge);
  return NextResponse.json(options);
}
