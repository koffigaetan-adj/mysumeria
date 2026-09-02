import { NextRequest, NextResponse, after } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { consumeChallenge, getRelyingParty } from "@/lib/webauthn";
import { getLoginContext } from "@/lib/loginContext";
import { isEmailConfigured, sendLoginAlert } from "@/lib/email";

// Connexion par Face ID / empreinte, étape 2 : vérification et ouverture de session.
export async function POST(request: NextRequest) {
  const expectedChallenge = await consumeChallenge();
  if (!expectedChallenge) return NextResponse.json({ error: "Challenge expiré, réessaie." }, { status: 400 });

  const { response } = await request.json().catch(() => ({}));
  if (!response || typeof response.id !== "string") {
    return NextResponse.json({ error: "Réponse invalide" }, { status: 400 });
  }

  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: response.id },
    include: { user: true },
  });
  if (!passkey) return NextResponse.json({ error: "Clé inconnue sur ce compte." }, { status: 401 });

  if (passkey.user.lockedUntil && passkey.user.lockedUntil > new Date()) {
    return NextResponse.json({ error: "Compte temporairement bloqué." }, { status: 423 });
  }

  const { rpID, origin } = getRelyingParty(request);
  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports,
      },
    });
    if (!verification.verified) {
      return NextResponse.json({ error: "Vérification refusée." }, { status: 401 });
    }

    await prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
    });
    await createSession({ userId: passkey.user.id, email: passkey.user.email });

    if (passkey.user.notifyOnLogin && isEmailConfigured()) {
      const ctx = getLoginContext(request);
      const email = passkey.user.email;
      after(() => sendLoginAlert(email, ctx));
    }

    return NextResponse.json({ ok: true, email: passkey.user.email, pinLength: passkey.user.pinLength });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[auth/passkey/verify] Échec :", e);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
