import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (session) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Les API protégées renvoient 401, les pages redirigent vers /login.
  // Exception : /api/gmail/* est navigué dans le navigateur (flux OAuth) → redirection.
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/gmail/")) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Tout est protégé SAUF : assets Next, login, routes d'auth,
  // /api/sync-emails et /api/monthly-statement (gèrent leur propre auth : session OU secret cron),
  // /api/gmail/push (webhook Google Pub/Sub, authentifié par ?token=),
  // manifest / icônes / service worker (nécessaires à la PWA avant connexion).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|api/auth/|api/sync-emails|api/monthly-statement|api/gmail/push|manifest.webmanifest|icons/|sw.js|workbox-|worker-).*)",
  ],
};
