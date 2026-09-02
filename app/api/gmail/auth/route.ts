import { NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/gmail";
import { getSession } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";

// Lance le flux OAuth Google : redirige vers l'écran de consentement.
// À faire UNE SEULE FOIS (ou si le refresh token est révoqué). Réservé à l'administrateur.
export async function GET() {
  const session = await getSession();
  if (!isAdminEmail(session?.email)) {
    return new NextResponse("Réservé à l'administrateur.", { status: 403 });
  }
  const oauth2 = getOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: "offline", // indispensable pour obtenir un refresh_token
    prompt: "consent", // force la réémission d'un refresh_token même si déjà autorisé
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
  });
  return NextResponse.redirect(url);
}
