// Verrouillage après inactivité : on mémorise le dernier moment d'activité sur l'appareil.
export const IDLE_LIMIT_MS = 30 * 60 * 1000;
const KEY = "sumeria-last-active";

export function markActive(): void {
  try {
    window.localStorage.setItem(KEY, String(Date.now()));
  } catch {
    // stockage indisponible : le verrouillage ne s'applique pas sur cet appareil
  }
}

/** Vrai si la dernière activité connue remonte à plus de IDLE_LIMIT_MS. */
export function isIdleExpired(): boolean {
  try {
    const last = Number(window.localStorage.getItem(KEY) ?? 0);
    return last > 0 && Date.now() - last > IDLE_LIMIT_MS;
  } catch {
    return false;
  }
}
