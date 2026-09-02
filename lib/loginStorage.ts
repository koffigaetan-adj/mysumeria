// Mémorisation côté navigateur de l'email et de la longueur du code,
// pour pré-remplir la page de connexion (jamais le code lui-même).
const STORAGE_KEY = "sumeria-login";

export type SavedLogin = { email: string; pinLength: number };

export function readSavedLogin(): SavedLogin | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.email !== "string") return null;
    return { email: parsed.email, pinLength: parsed.pinLength === 6 ? 6 : 8 };
  } catch {
    return null;
  }
}

export function writeSavedLogin(saved: SavedLogin): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // simple confort, pas bloquant si le stockage échoue
  }
}
