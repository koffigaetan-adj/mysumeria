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

// Montant : "1,50", "12", "1 234,56" (espaces, espaces insécables), avec ou sans décimales
const AMOUNT = String.raw`(\d[\d\s  ]*(?:[.,]\d{1,2})?)\s*(?:€|EUR|euros?)`;
// Fin d'un motif : on s'arrête avant la mention de la carte / du moyen de paiement, ou une ponctuation forte
const MOTIF_END = String.raw`(?=[.,;](?:\s|$)|\s+(?:avec (?:la|votre|ta) carte|par carte|via|avec apple pay|avec google pay|le paiement|la somme|depuis|sur (?:votre|le|ton) compte|$))`;

/** Nettoie un motif capturé : espaces et ponctuation de fin. */
function cleanMotif(raw: string): string {
  return raw.trim().replace(/[\s.,;:]+$/, "");
}

function parseMontant(raw: string): number {
  return parseFloat(raw.replace(/[\s  ]/g, "").replace(",", "."));
}

/**
 * Met le texte de l'email sur une seule ligne : retours à la ligne, lignes de
 * séparation (-----, =====, ____) et espaces multiples deviennent un espace simple.
 * Les matchers travaillent sur ce texte, quel que soit le format d'origine (texte brut ou HTML aplati).
 */
export function normalizeEmailText(text: string): string {
  return text
    .replace(/[  ]/g, " ")
    .replace(/[-=_*]{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Coupe le corps en partie principale / pied de page ("Pourquoi je reçois cet email ?"). */
function splitFooter(text: string): { main: string; footer: string } {
  const idx = text.search(/Pourquoi je re[cç]ois cet e-?mail/i);
  return idx === -1 ? { main: text, footer: "" } : { main: text.slice(0, idx), footer: text.slice(idx) };
}

/**
 * Compte concerné : d'abord une mention explicite dans le corps ("prélevée sur votre
 * compte « X »", "sur votre compte « X »"), sinon le compte sur lequel l'alerte est
 * activée (pied de page) — les alertes Sumeria étant configurées par compte.
 */
function detectAccount(main: string, footer: string): string | null {
  const explicit =
    main.match(/(?:prélevée?|débitée?|créditée?|reçue?|versée?)\s+sur\s+(?:votre|ton|le)\s+compte\s*«\s*([^»]+?)\s*»/i) ??
    main.match(/(?:sur|depuis)\s+(?:votre|ton|le)\s+compte\s*«\s*([^»]+?)\s*»/i);
  if (explicit) return explicit[1].trim();
  const alert = footer.match(/activée?\s+sur\s+(?:votre|ton|le)\s+compte\s*«\s*([^»]+?)\s*»/i);
  return alert ? alert[1].trim() : null;
}

type Matcher = (main: string, footer: string, targetAccountEnv: string | undefined) => ParsedTransaction | null;

/**
 * Virement entre comptes Sumeria (reçu ou envoyé) — même template dans les deux sens :
 * "+ 2,00 € sur « Compte courant Julienne ». … depuis votre compte « Compte Courant »."
 * Le sens est déduit en comparant les deux comptes cités à BANK_ACCOUNT_NAME.
 */
const matchVirementInterne: Matcher = (main, _footer, targetAccountEnv) => {
  const m = main.match(new RegExp(String.raw`\+\s*${AMOUNT}\s*sur\s*«\s*([^»]+?)\s*»`, "i"));
  if (!m) return null;
  const montant = parseMontant(m[1]);
  const targetCompte = m[2].trim();
  const source = main.match(/depuis\s+(?:votre|ton|le)\s+compte\s*«\s*([^»]+?)\s*»/i);
  const sourceCompte = source ? source[1].trim() : null;

  if (targetAccountEnv && isTargetAccount(sourceCompte, targetAccountEnv)) {
    return { montant, type: "DEBIT", motif: `Virement vers « ${targetCompte} »`, date: new Date(0), compteName: sourceCompte };
  }
  return {
    montant,
    type: "CREDIT",
    motif: sourceCompte ? `Virement depuis « ${sourceCompte} »` : "Virement reçu",
    date: new Date(0),
    compteName: targetCompte,
  };
};

/** Paiement par carte : "Vous avez réglé 1,50 € à DIAGONAL avec la carte « … »" (sans contact, en ligne, Apple Pay…). */
const matchPaiementCarte: Matcher = (main, footer) => {
  const m =
    main.match(new RegExp(String.raw`Vous avez (?:réglé|payé|dépensé)\s+${AMOUNT}\s+(?:à|chez|auprès de)\s+(.+?)${MOTIF_END}`, "i")) ??
    main.match(new RegExp(String.raw`(?:Paiement|Achat)\s+de\s+${AMOUNT}\s+(?:à|chez|auprès de)\s+(.+?)${MOTIF_END}`, "i"));
  if (!m) return null;
  return { montant: parseMontant(m[1]), type: "DEBIT", motif: cleanMotif(m[2]), date: new Date(0), compteName: detectAccount(main, footer) };
};

/** Retrait d'espèces : "Vous avez retiré 50 € …" / "Retrait de 50 € …". */
const matchRetrait: Matcher = (main, footer) => {
  const m =
    main.match(new RegExp(String.raw`Vous avez retiré\s+${AMOUNT}`, "i")) ??
    main.match(new RegExp(String.raw`Retrait\s+(?:de\s+)?${AMOUNT}`, "i"));
  if (!m) return null;
  const where = main.match(/(?:au|à|chez)\s+(?:distributeur|DAB|guichet)?\s*(.+?)(?=\s+(?:avec|le retrait|la somme|\.|$))/i);
  return {
    montant: parseMontant(m[1]),
    type: "DEBIT",
    motif: where && cleanMotif(where[1]).length > 2 ? `Retrait ${cleanMotif(where[1])}` : "Retrait d'espèces",
    date: new Date(0),
    compteName: detectAccount(main, footer),
  };
};

/** Prélèvement : "Prélèvement de 9,99 € par NETFLIX" / "NETFLIX a prélevé 9,99 €" / "Un prélèvement de … de NETFLIX". */
const matchPrelevement: Matcher = (main, footer) => {
  const m =
    main.match(new RegExp(String.raw`Pr[ée]l[èe]vement\s+(?:de\s+)?${AMOUNT}\s+(?:par|de|pour|au profit de)\s+(.+?)${MOTIF_END}`, "i")) ??
    main.match(new RegExp(String.raw`(.+?)\s+a\s+prélevé\s+${AMOUNT}`, "i"));
  if (!m) return null;
  // Selon la forme, le motif est en groupe 2 ou en groupe 1
  const [montantRaw, motif] = /prélevé/i.test(m[0]) && !/^Pr[ée]l/i.test(m[0]) ? [m[2], m[1]] : [m[1], m[2]];
  return { montant: parseMontant(montantRaw), type: "DEBIT", motif: `Prélèvement ${cleanMotif(motif)}`, date: new Date(0), compteName: detectAccount(main, footer) };
};

/** Remboursement : "Vous avez été remboursé de 12 € par AMAZON" / "Remboursement de 12 € de AMAZON". */
const matchRemboursement: Matcher = (main, footer) => {
  const m =
    main.match(new RegExp(String.raw`rembours[ée]e?\s+(?:de\s+)?${AMOUNT}\s+(?:par|de)\s+(.+?)${MOTIF_END}`, "i")) ??
    main.match(new RegExp(String.raw`Remboursement\s+(?:de\s+)?${AMOUNT}(?:\s+(?:par|de)\s+(.+?)${MOTIF_END})?`, "i"));
  if (!m) return null;
  return {
    montant: parseMontant(m[1]),
    type: "CREDIT",
    motif: m[2] ? `Remboursement ${cleanMotif(m[2])}` : "Remboursement",
    date: new Date(0),
    compteName: detectAccount(main, footer),
  };
};

/** Virement reçu d'un tiers : "Vous avez reçu 50 € de Marie" / "Marie vous a envoyé 50 €". */
const matchVirementRecu: Matcher = (main, footer) => {
  const m =
    main.match(new RegExp(String.raw`Vous avez reçu\s+${AMOUNT}(?:\s+(?:de|de la part de)\s+(.+?)${MOTIF_END})?`, "i")) ??
    main.match(new RegExp(String.raw`(.+?)\s+vous a envoyé\s+${AMOUNT}`, "i"));
  if (!m) return null;
  const isSecondForm = /vous a envoyé/i.test(m[0]);
  const montant = parseMontant(isSecondForm ? m[2] : m[1]);
  const fromRaw = isSecondForm ? m[1] : m[2];
  const from = fromRaw ? cleanMotif(fromRaw) : undefined;
  return { montant, type: "CREDIT", motif: from ? `Virement de ${from}` : "Virement reçu", date: new Date(0), compteName: detectAccount(main, footer) };
};

/** Virement envoyé à un tiers : "Vous avez envoyé 50 € à Marie" / "Virement de 50 € vers Marie". */
const matchVirementEnvoye: Matcher = (main, footer) => {
  const m =
    main.match(new RegExp(String.raw`Vous avez (?:envoyé|viré|transféré)\s+${AMOUNT}\s+(?:à|vers|au profit de)\s+(.+?)${MOTIF_END}`, "i")) ??
    main.match(new RegExp(String.raw`Virement\s+(?:de\s+)?${AMOUNT}\s+(?:vers|à|au profit de)\s+(.+?)${MOTIF_END}`, "i"));
  if (!m) return null;
  return { montant: parseMontant(m[1]), type: "DEBIT", motif: `Virement vers ${cleanMotif(m[2])}`, date: new Date(0), compteName: detectAccount(main, footer) };
};

// Ordre : du plus spécifique au plus générique (le virement interne d'abord, il a un template unique).
const MATCHERS: Matcher[] = [
  matchVirementInterne,
  matchPaiementCarte,
  matchRetrait,
  matchPrelevement,
  matchRemboursement,
  matchVirementRecu,
  matchVirementEnvoye,
];

/**
 * Parse le contenu d'un email d'alerte bancaire Sumeria.
 *
 * @param subject          Sujet de l'email
 * @param body             Corps de l'email (texte brut ou HTML aplati — normalisé ici)
 * @param receivedAt       Date de réception, utilisée comme date de transaction
 * @param targetAccountEnv BANK_ACCOUNT_NAME — nécessaire pour déterminer le sens d'un virement interne
 */
export function parseBankEmail(
  subject: string,
  body: string,
  receivedAt: Date,
  targetAccountEnv: string | undefined
): ParsedTransaction | null {
  if (describeNonTransactionAlert(subject, body)) return null;

  const { main, footer } = splitFooter(normalizeEmailText(`${subject} ${body}`));
  for (const matcher of MATCHERS) {
    const result = matcher(main, footer, targetAccountEnv);
    if (result && Number.isFinite(result.montant) && result.montant > 0) {
      return { ...result, date: receivedAt };
    }
  }
  return null;
}

/**
 * Alertes Sumeria qui ne correspondent à aucun mouvement d'argent (paiement refusé,
 * plafond, etc.). Reconnues pour être classées avec une raison explicite.
 */
export function describeNonTransactionAlert(subject: string, body: string): string | null {
  const text = normalizeEmailText(`${subject} ${body}`);
  if (/solde insuffisant/i.test(text)) return "Alerte sans mouvement : paiement refusé (solde insuffisant)";
  if (/paiement refus|transaction refus|carte refus|a été refusé/i.test(text)) return "Alerte sans mouvement : paiement refusé";
  if (/plafond/i.test(text)) return "Alerte sans mouvement : plafond de carte";
  if (/code (pin|secret) (erron|incorrect)/i.test(text)) return "Alerte sans mouvement : code carte erroné";
  if (/carte (?:bloquée|désactivée|activée|commandée|expédiée|virtuelle)|apple pay|google pay/i.test(text)) return "Information : carte (pas un mouvement)";
  if (/mot de passe|accéder à sumeria|code de connexion|nouvel appareil/i.test(text)) return "Information : sécurité du compte (pas un mouvement)";
  if (/nouveau compte ouvert|bienvenue|compte (?:a été )?(?:ouvert|créé|clôturé)/i.test(text)) return "Information : compte (pas un mouvement)";
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
 * - Filtre configuré mais compte non détecté → rejeté par prudence (évite de fausser le solde).
 */
export function isTargetAccount(compteName: string | null, targetAccountEnv: string | undefined): boolean {
  if (!targetAccountEnv) return true;
  if (!compteName) return false;
  return normalizeAccountName(compteName) === normalizeAccountName(targetAccountEnv);
}
