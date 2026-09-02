/**
 * Administrateur = email(s) listé(s) dans ADMIN_EMAIL (séparés par des virgules).
 * Réserve les actions de configuration (accès Gmail) à ce compte.
 * Si la variable est absente, tout le monde est administrateur (évite de se bloquer).
 */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const configured = getAdminEmails();
  if (configured.length === 0) return true;
  return Boolean(email) && configured.includes(email!.trim().toLowerCase());
}
