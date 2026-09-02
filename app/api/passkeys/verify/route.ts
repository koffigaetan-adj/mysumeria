import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { consumeChallenge, getRelyingParty } from "@/lib/webauthn";
import { describeUserAgent } from "@/lib/loginContext";

// Étape 2 : vérification de la réponse du navigateur et enregistrement de la clé.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const expectedChallenge = await consumeChallenge();
  if (!expectedChallenge) return NextResponse.json({ error: "Challenge expiré, réessaie." }, { status: 400 });

  const { response, deviceName } = await request.json().catch(() => ({}));
  const { rpID, origin } = getRelyingParty(request);

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified) {
      return NextResponse.json({ error: "Vérification refusée." }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;
    const passkey = await prisma.passkey.create({
      data: {
        userId: session.userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? [],
        deviceName:
          typeof deviceName === "string" && deviceName.trim()
            ? deviceName.trim().slice(0, 60)
            : describeUserAgent(request.headers.get("user-agent") ?? ""),
      },
      select: { id: true, deviceName: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, passkey });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[passkeys/verify] Échec :", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
