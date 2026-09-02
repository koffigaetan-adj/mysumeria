import type { NextRequest } from "next/server";

export type LoginContext = {
  date: Date;
  ip: string;
  location: string;
  device: string;
};

/** Description lisible de l'appareil à partir du User-Agent (sans dépendance, volontairement grossier). */
export function describeUserAgent(ua: string): string {
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "Appareil inconnu";

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua) && !/Chromium/.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "navigateur inconnu";

  return `${os} · ${browser}`;
}

/** IP + localisation approximative (en-têtes fournis par Vercel en prod) + appareil. */
export function getLoginContext(request: NextRequest): LoginContext {
  const h = request.headers;
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "inconnue";

  const city = h.get("x-vercel-ip-city");
  const region = h.get("x-vercel-ip-country-region");
  const country = h.get("x-vercel-ip-country");
  const parts = [city && decodeURIComponent(city), region, country].filter(Boolean);
  const location = parts.length > 0 ? parts.join(", ") : "inconnue (hors Vercel)";

  return {
    date: new Date(),
    ip,
    location,
    device: describeUserAgent(h.get("user-agent") ?? ""),
  };
}
