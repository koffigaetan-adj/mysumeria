import { parseBankEmail, isTargetAccount, describeNonTransactionAlert } from "../lib/parseBankEmail";

const TARGET = "Compte courant Julienne";
const ALERT_FOOTER =
  "\r\n\r\nPourquoi je reçois cet email ?\r\nUne alerte « Dépenses supérieures à » est activée sur votre compte « Compte courant Julienne ».\r\nCliquez ici pour en savoir plus.";
// Pied de page légal RÉEL, présent sur TOUS les emails Sumeria — contient le piège
// "vous avez un compte ouvert dans les livres de Lydia Solutions" (littéralement "compte ouvert").
const LEGAL_FOOTER =
  "\r\n\r\nUne question ? Un problème ?\r\n\r\nLa réponse se trouve sûrement dans notre manuel d'utilisation ( https://support.sumeria.eu/l/fr ).\r\n\r\nCet email traite d’une information importante. A ce titre, il ne contient pas de lien pour vous désabonner. Vous recevez cet email parce que vous avez un compte ouvert dans les livres de Lydia Solutions, même si vous êtes désabonné des emails commerciaux.\r\n\r\nLe nom de domaine sumeria.eu appartient à Lydia Solutions, y compris les adresses email avec le suffixe « @sumeria.eu ».\r\n\r\nLYDIA SOLUTIONS est agréée et supervisée par l'Autorité de Contrôle Prudentiel et de Résolution (« ACPR ») en tant qu'établissement de monnaie électronique habilité à délivrer des services de paiements. Code banque (CIB) : 17598.";

const cases: Array<[string, string, string]> = [
  [
    "Paiement sans contact (texte brut réel, tirets)",
    "- 1,50 € à DIAGONAL",
    "La somme a été prélevée sur votre compte « Compte courant Julienne »  \r\n\r\n \r\n\r\nSumeria app\r\n\r\n--------------------------------------\r\nVous avez réglé 1,50 € à DIAGONAL\r\n--------------------------------------\r\n\r\navec la carte « Carte Julienne »\r\n\r\nLe paiement a été fait en sans contact.\r\n\r\nLa somme a été prélevée sur votre compte « Compte courant Julienne ».\r\n\r\nVous pouvez consulter l'historique ici ( https://go.sumeria.eu/x ).\r\n\r\nSumeria" +
      ALERT_FOOTER +
      LEGAL_FOOTER,
  ],
  [
    "Paiement en ligne (HTML aplati)",
    "Paiement",
    "Vous avez réglé 17,18 € à ANTHROPIC* CLAUDE SUB avec la carte « Carte Sans Contact » Le paiement a été fait en ligne. La somme a été prélevée sur votre compte « Compte courant Julienne »." +
      ALERT_FOOTER +
      LEGAL_FOOTER,
  ],
  [
    "Virement interne reçu",
    "Virement confirmé",
    "+ 2,00 € sur « Compte courant Julienne ».\r\n\r\nLe virement a été exécuté instantanément depuis votre compte « Compte Courant »." + ALERT_FOOTER + LEGAL_FOOTER,
  ],
  [
    "Virement interne envoyé",
    "Virement confirmé",
    "+ 2,00 € sur « Compte Courant ».\r\n\r\nLe virement a été exécuté instantanément depuis votre compte « Compte courant Julienne »." + ALERT_FOOTER + LEGAL_FOOTER,
  ],
  [
    // Cas réel qui avait été ignoré à tort (2026-09-04) : sujet = la ligne de montant elle-même
    // ("+ 4,00 € sur « ... »"), pas "Virement confirmé". Régression : le pied de page légal
    // contient "compte ouvert" et déclenchait par erreur "Information : compte" avant matching.
    "Virement interne reçu, sujet = montant (régression pied de page légal)",
    "+ 4,00 € sur « Compte courant Julienne »",
    "Sumeria\r\n\r\n \r\n\r\n------------------\r\nVirement confirmé\r\n------------------\r\n\r\n+ 4,00 € sur « Compte courant Julienne ».\r\n\r\nLe virement a été exécuté instantanément depuis votre compte « Compte Courant »." +
      ALERT_FOOTER +
      LEGAL_FOOTER,
  ],
  [
    "Paiement sur un AUTRE compte (doit être exclu)",
    "Paiement",
    "Vous avez réglé 9,00 € à CARREFOUR avec la carte « Carte » La somme a été prélevée sur votre compte « Compte Courant »." + LEGAL_FOOTER,
  ],
  [
    "Retrait",
    "Retrait",
    "Vous avez retiré 50 € au distributeur BNP PARIBAS PARIS avec la carte « Carte Julienne ». La somme a été prélevée sur votre compte « Compte courant Julienne »." + LEGAL_FOOTER,
  ],
  ["Prélèvement", "Prélèvement", "Prélèvement de 9,99 € par NETFLIX. La somme a été prélevée sur votre compte « Compte courant Julienne »." + LEGAL_FOOTER],
  [
    "Remboursement",
    "Remboursement",
    "Vous avez été remboursé de 12,30 € par AMAZON EU. La somme a été créditée sur votre compte « Compte courant Julienne »." + LEGAL_FOOTER,
  ],
  ["Virement reçu d'un tiers (compte via pied de page)", "Virement reçu", "Vous avez reçu 150 € de Marie Dupont." + ALERT_FOOTER + LEGAL_FOOTER],
  [
    "Virement envoyé à un tiers",
    "Virement",
    "Vous avez envoyé 40 € à Paul Martin depuis votre compte « Compte courant Julienne »." + LEGAL_FOOTER,
  ],
  [
    "Montant avec milliers et sans décimales",
    "Paiement",
    "Vous avez réglé 1 200 € à IKEA avec la carte « Carte Julienne ». La somme a été prélevée sur votre compte « Compte courant Julienne »." + LEGAL_FOOTER,
  ],
  [
    "Paiement refusé (ne doit PAS créer de transaction)",
    "Carte : solde insuffisant",
    "Votre paiement de 30 € à FNAC a été refusé : solde insuffisant." + ALERT_FOOTER + LEGAL_FOOTER,
  ],
];

let failures = 0;
for (const [name, subject, body] of cases) {
  const parsed = parseBankEmail(subject, body, new Date("2026-09-03T07:27:16Z"), TARGET);
  const accepted = parsed ? isTargetAccount(parsed.compteName, TARGET) : false;
  const summary = parsed ? `${parsed.type} ${parsed.montant} € | ${parsed.motif} | compte=${parsed.compteName} | ${accepted ? "ACCEPTÉ" : "exclu"}` : "null";
  const expectNull = /refusé|AUTRE compte/.test(name);
  const ok = expectNull ? !accepted : accepted;
  if (!ok) failures++;
  console.log(`${ok ? "✅" : "❌"} ${name}\n     → ${summary}`);
}

// Emails d'information réels (pas de mouvement) : la raison ne doit JAMAIS venir du
// pied de page légal universel, seulement du contenu réel de l'email.
const infoCases: Array<[string, string, string]> = [
  ["Nouveau compte ouvert", "Nouveau compte ouvert", "Confirmation d'ouverture de votre compte Sumeria. Votre compte « Compte Julienne » a bien été créé." + LEGAL_FOOTER],
  ["Carte virtuelle créée", "Carte virtuelle créée", "Vous avez créé une carte virtuelle. Pour l'utiliser, copiez son numéro." + LEGAL_FOOTER],
  ["Mot de passe modifié", "Votre mot de passe vient d'être modifié", "Si vous n'êtes pas à l'origine de cette modification, contactez-nous." + LEGAL_FOOTER],
  ["Accéder à Sumeria (lien de connexion)", "Accéder à Sumeria", "Votre demande d'accès a été validée. Cliquez ici pour vous reconnecter." + LEGAL_FOOTER],
  ["Nouvel IBAN créé", "Nouvel IBAN à partager créé", "Nous vous avons créé un IBAN, rien que pour vous." + LEGAL_FOOTER],
  ["Carte ajoutée à Apple Pay", "Votre carte a bien été ajoutée sur Apple Pay", "Vous pouvez dès à présent payer avec votre smartphone." + LEGAL_FOOTER],
];

console.log("");
for (const [name, subject, body] of infoCases) {
  const reason = describeNonTransactionAlert(subject, body);
  const ok = reason !== null;
  if (!ok) failures++;
  console.log(`${ok ? "✅" : "❌"} ${name}\n     → ${reason ?? "null (BUG : devrait être détecté comme information, pas comme transaction)"}`);
}

console.log(failures === 0 ? "\nTous les cas passent." : `\n${failures} cas en échec.`);
process.exit(failures === 0 ? 0 : 1);
