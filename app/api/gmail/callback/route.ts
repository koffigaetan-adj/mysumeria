import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/gmail";
import { getSession } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";

// Callback OAuth : échange le code contre les tokens et AFFICHE le refresh
// token pour que tu le copies dans la variable d'environnement GMAIL_REFRESH_TOKEN.
// (Il n'est volontairement pas stocké en base : une seule boîte Gmail est lue,
// l'env var suffit et reste hors du code.)
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!isAdminEmail(session?.email)) {
    return html(`<h1>Accès refusé</h1><p>Cette action est réservée à l'administrateur.</p>`);
  }

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return html(`<h1>Autorisation refusée</h1><p>Google a renvoyé : <code>${escapeHtml(error)}</code></p>`);
  }
  if (!code) {
    return html(`<h1>Paramètre manquant</h1><p>Aucun code OAuth reçu. Relance depuis <a href="/api/gmail/auth">/api/gmail/auth</a>.</p>`);
  }

  try {
    const oauth2 = getOAuth2Client();
    const { tokens } = await oauth2.getToken(code);

    if (!tokens.refresh_token) {
      return html(
        `<h1>Pas de refresh token reçu</h1>
         <p>Google n'en renvoie un que lors du premier consentement. Va révoquer l'accès de l'app sur
         <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a>
         puis relance <a href="/api/gmail/auth">/api/gmail/auth</a>.</p>`
      );
    }

    return html(
      `<h1>Autorisation réussie</h1>
       <p>Copie cette valeur dans ta variable d'environnement <code>GMAIL_REFRESH_TOKEN</code>
       (fichier <code>.env</code> en local, et Settings → Environment Variables sur Vercel) :</p>
       <pre style="background:#f1f5f9;padding:16px;border-radius:8px;word-break:break-all;white-space:pre-wrap;">${escapeHtml(tokens.refresh_token)}</pre>
       <p>Puis redémarre le serveur (ou redéploie) et teste la synchro depuis le dashboard.</p>
       <p><a href="/">← Retour au dashboard</a></p>`
    );
  } catch (e) {
    console.error("[gmail/callback] Échec de l'échange du code OAuth:", e);
    return html(`<h1>Erreur</h1><p>Échec de l'échange du code OAuth. Regarde les logs serveur.</p>`);
  }
}

function html(body: string) {
  return new NextResponse(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gmail OAuth</title></head><body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px;">${body}</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
