export type ParsedTransaction = {
  /** Montant absolu en euros, ex: 12.5 */
  montant: number;
  type: "CREDIT" | "DEBIT";
  /** Libellé / motif de la transaction, null si non détecté */
  motif: string | null;
  /** Date de la transaction (à défaut, la date de réception de l'email) */
  date: Date;
  /** Nom du compte/sous-compte débité ou crédité (ex: "Compte courant Julienne"), null si non détecté */
  compteName: string | null;
};

function parseMontant(raw: string): number {
  return parseFloat(raw.replace(/\s/g, "").replace(",", "."));
}

/**
 * Le template Sumeria pour un virement est le même que la transaction soit
 * entrante ou sortante : seuls les rôles "compte crédité" / "compte débité"
 * sont inversés. Il faut donc savoir lequel des deux est BANK_ACCOUNT_NAME
 * pour déterminer si c'est un CREDIT (reçu) ou un DEBIT (envoyé).
 */
function resolveVirementDirection(
  sourceCompte: string | null,
  targetCompte: string,
  targetAccountEnv: string | undefined
): { type: "CREDIT" | "DEBIT"; compteName: string; motif: string } | null {
  if (!targetAccountEnv) return null; // aucun filtre configuré : impossible de savoir quel côté est le nôtre

  if (isTargetAccount(sourceCompte, targetAccountEnv)) {
    return {
      type: "DEBIT",
      compteName: sourceCompte!,
      motif: `Virement vers « ${targetCompte} »`,
    };
  }
  if (isTargetAccount(targetCompte, targetAccountEnv)) {
    return {
      type: "CREDIT",
      compteName: targetCompte,
      motif: sourceCompte ? `Virement depuis « ${sourceCompte} »` : "Virement reçu",
    };
  }
  return null; // virement entre deux comptes qui ne sont ni l'un ni l'autre le nôtre
}

/**
 * Virement (reçu ou envoyé), ex :
 * "Virement confirmé + 2,00 € sur « Compte courant Julienne ». Le virement a été
 *  exécuté instantanément depuis votre compte « Compte Courant »." (reçu)
 * "Virement confirmé + 2,00 € sur « Compte Courant ». Le virement a été
 *  exécuté instantanément depuis votre compte « Compte courant Julienne »." (envoyé)
 */
function matchVirement(body: string, targetAccountEnv: string | undefined): ParsedTransaction | null {
  const m = body.match(/\+\s*([\d]+(?:[.,]\d{2})?)\s*€\s*sur\s*«\s*([^»]+?)\s*»/i);
  if (!m) return null;

  const targetCompte = m[2].trim();
  const sourceMatch = body.match(/depuis votre compte\s*«\s*([^»]+?)\s*»/i);
  const sourceCompte = sourceMatch ? sourceMatch[1].trim() : null;

  const direction = resolveVirementDirection(sourceCompte, targetCompte, targetAccountEnv);

  return {
    montant: parseMontant(m[1]),
    date: new Date(0), // remplacé par receivedAt dans parseBankEmail
    ...(direction ?? {
      type: "CREDIT",
      motif: sourceCompte ? `Virement depuis « ${sourceCompte} »` : "Virement reçu",
      compteName: targetCompte,
    }),
  };
}

/**
 * Paiement par carte, ex :
 * "Vous avez réglé 17,18 € à ANTHROPIC* CLAUDE SUB avec la carte « Carte Sans Contact »
 *  [...] La somme a été prélevée sur votre compte « Compte courant Julienne »."
 */
function matchPaiementCarte(body: string, _targetAccountEnv: string | undefined): ParsedTransaction | null {
  const m = body.match(/Vous avez réglé\s+([\d]+(?:[.,]\d{2})?)\s*€\s*à\s+(.+?)\s+avec la carte/i);
  if (!m) return null;

  const compte = body.match(/prélevée sur (?:votre compte|«)\s*«?\s*([^»]+?)\s*»/i);

  return {
    montant: parseMontant(m[1]),
    type: "DEBIT",
    motif: m[2].trim(),
    date: new Date(0), // remplacé par receivedAt dans parseBankEmail
    compteName: compte ? compte[1].trim() : null,
  };
}

const MATCHERS = [matchVirement, matchPaiementCarte];

/**
 * Parse le contenu d'un email d'alerte bancaire Sumeria.
 *
 * Formats reconnus pour l'instant :
 * - Virement reçu ou envoyé ("Virement confirmé")
 * - Paiement par carte ("Vous avez réglé ... à ... avec la carte")
 * D'autres formats (prélèvement, etc.) seront ajoutés au fur et à mesure,
 * à partir d'exemples réels stockés dans UnparsedEmail.
 *
 * @param subject          Sujet de l'email
 * @param body             Corps texte de l'email (déjà décodé, HTML retiré)
 * @param receivedAt       Date de réception de l'email, utilisée comme date de transaction
 * @param targetAccountEnv BANK_ACCOUNT_NAME — nécessaire pour déterminer le sens
 *                         (CREDIT/DEBIT) d'un virement, qui utilise le même
 *                         template que la transaction soit entrante ou sortante.
 */
export function parseBankEmail(
  subject: string,
  body: string,
  receivedAt: Date,
  targetAccountEnv: string | undefined
): ParsedTransaction | null {
  void subject;

  for (const matcher of MATCHERS) {
    const result = matcher(body, targetAccountEnv);
    if (result) return { ...result, date: receivedAt };
  }

  return null;
}

/**
 * Alertes Sumeria qui ne correspondent à aucun mouvement d'argent (paiement refusé,
 * plafond, etc.). On les reconnaît pour les classer avec une raison explicite plutôt
 * que "non reconnu par le parseur".
 */
export function describeNonTransactionAlert(subject: string, body: string): string | null {
  const text = `${subject} ${body}`;
  if (/solde insuffisant/i.test(text)) return "Alerte sans mouvement : paiement refusé (solde insuffisant)";
  if (/paiement refus|transaction refus|carte refus/i.test(text)) return "Alerte sans mouvement : paiement refusé";
  if (/plafond/i.test(text)) return "Alerte sans mouvement : plafond de carte";
  if (/code (pin|secret) (erron|incorrect)/i.test(text)) return "Alerte sans mouvement : code carte erroné";
  return null;
}

function normalizeAccountName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Vérifie si une transaction parsée concerne le sous-compte suivi (BANK_ACCOUNT_NAME).
 * - Pas de filtre configuré → tout est accepté.
 * - Filtre configuré mais compte non détecté dans l'email → rejeté par prudence
 *   (évite de fausser le solde en devinant).
 */
export function isTargetAccount(compteName: string | null, targetAccountEnv: string | undefined): boolean {
  if (!targetAccountEnv) return true;
  if (!compteName) return false;
  return normalizeAccountName(compteName) === normalizeAccountName(targetAccountEnv);
}
