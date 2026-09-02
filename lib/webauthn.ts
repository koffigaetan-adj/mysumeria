import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

export const RP_NAME = "My Sumeria";
const CHALLENGE_COOKIE = "webauthn-challenge";

/** Identité du site pour WebAuthn, déduite de l'hôte (localhost en dev, le domaine Vercel en prod). */
export function getRelyingParty(request: NextRequest): { rpID: string; origin: string } {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { rpID: host.split(":")[0], origin: `${proto}://${host}` };
}

/** Le challenge est gardé 5 min dans un cookie httpOnly entre "options" et "verify". */
export async function storeChallenge(challenge: string): Promise<void> {
  const store = await cookies();
  store.set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 300,
  });
}

export async function consumeChallenge(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(CHALLENGE_COOKIE)?.value ?? null;
  store.delete(CHALLENGE_COOKIE);
  return value;
}
