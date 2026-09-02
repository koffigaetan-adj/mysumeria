import { NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/gmail";

// Lance le flux OAuth Google : redirige vers l'écran de consentement.
// À faire UNE SEULE FOIS (ou si le refresh token est révoqué).
export async function GET() {
  const oauth2 = getOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: "offline", // indispensable pour obtenir un refresh_token
    prompt: "consent", // force la réémission d'un refresh_token même si déjà autorisé
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
  });
  return NextResponse.redirect(url);
}
