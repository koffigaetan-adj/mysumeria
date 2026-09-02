import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { getRelyingParty, storeChallenge } from "@/lib/webauthn";

// Connexion par Face ID / empreinte, étape 1 : options pour le navigateur.
// Avec un email connu on restreint aux clés de ce compte ; sinon le navigateur
// propose les clés "découvrables" qu'il a pour ce site.
export async function POST(request: NextRequest) {
  const { email } = await request.json().catch(() => ({}));
  const { rpID } = getRelyingParty(request);

  let allowCredentials: Array<{ id: string; transports?: string[] }> | undefined;
  if (typeof email === "string" && email.includes("@")) {
    const passkeys = await prisma.passkey.findMany({
      where: { user: { email: email.trim().toLowerCase() } },
      select: { credentialId: true, transports: true },
    });
    allowCredentials = passkeys.map((p) => ({ id: p.credentialId, transports: p.transports }));
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials,
  });

  await storeChallenge(options.challenge);
  return NextResponse.json(options);
}
