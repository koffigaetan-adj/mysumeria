import { google, gmail_v1 } from "googleapis";

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI manquants dans les variables d'environnement"
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGmailClient(): gmail_v1.Gmail {
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      "GMAIL_REFRESH_TOKEN manquant. Va sur /api/gmail/auth pour autoriser l'accès et récupérer le token."
    );
  }
  const auth = getOAuth2Client();
  auth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth });
}

/** Décode une chaîne base64url (format utilisé par l'API Gmail pour les corps de mail). */
function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

/**
 * Extrait le corps texte d'un message Gmail.
 * Préfère text/plain, sinon text/html (balises grossièrement retirées).
 */
export function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  const parts: gmail_v1.Schema$MessagePart[] = [];
  const stack: gmail_v1.Schema$MessagePart[] = [payload];
  while (stack.length > 0) {
    const part = stack.pop()!;
    parts.push(part);
    if (part.parts) stack.push(...part.parts);
  }

  const plain = parts.find((p) => p.mimeType === "text/plain" && p.body?.data);
  if (plain?.body?.data) return decodeBase64Url(plain.body.data);

  const html = parts.find((p) => p.mimeType === "text/html" && p.body?.data);
  if (html?.body?.data) {
    return decodeBase64Url(html.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&euro;/g, "€")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

export function getHeader(message: gmail_v1.Schema$Message, name: string): string {
  const header = message.payload?.headers?.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return header?.value ?? "";
}
