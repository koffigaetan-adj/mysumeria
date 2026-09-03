import { parseBankEmail, isTargetAccount } from "../lib/parseBankEmail";

const TARGET = "Compte courant Julienne";
const FOOTER =
  "\r\n\r\nPourquoi je reçois cet email ?\r\nUne alerte « Dépenses supérieures à » est activée sur votre compte « Compte courant Julienne ».\r\nCliquez ici pour en savoir plus.";

const cases: Array<[string, string, string]> = [
  [
    "Paiement sans contact (texte brut réel, tirets)",
    "- 1,50 € à DIAGONAL",
    "La somme a été prélevée sur votre compte « Compte courant Julienne »  \r\n\r\n \r\n\r\nSumeria app\r\n\r\n--------------------------------------\r\nVous avez réglé 1,50 € à DIAGONAL\r\n--------------------------------------\r\n\r\navec la carte « Carte Julienne »\r\n\r\nLe paiement a été fait en sans contact.\r\n\r\nLa somme a été prélevée sur votre compte « Compte courant Julienne ».\r\n\r\nVous pouvez consulter l'historique ici ( https://go.sumeria.eu/x ).\r\n\r\nSumeria" +
      FOOTER,
  ],
  [
    "Paiement en ligne (HTML aplati)",
    "Paiement",
    "Vous avez réglé 17,18 € à ANTHROPIC* CLAUDE SUB avec la carte « Carte Sans Contact » Le paiement a été fait en ligne. La somme a été prélevée sur votre compte « Compte courant Julienne »." + FOOTER,
  ],
  [
    "Virement interne reçu",
    "Virement confirmé",
    "+ 2,00 € sur « Compte courant Julienne ».\r\n\r\nLe virement a été exécuté instantanément depuis votre compte « Compte Courant »." + FOOTER,
  ],
  [
    "Virement interne envoyé",
    "Virement confirmé",
    "+ 2,00 € sur « Compte Courant ».\r\n\r\nLe virement a été exécuté instantanément depuis votre compte « Compte courant Julienne »." + FOOTER,
  ],
  ["Paiement sur un AUTRE compte (doit être exclu)", "Paiement", "Vous avez réglé 9,00 € à CARREFOUR avec la carte « Carte » La somme a été prélevée sur votre compte « Compte Courant »."],
  ["Retrait", "Retrait", "Vous avez retiré 50 € au distributeur BNP PARIBAS PARIS avec la carte « Carte Julienne ». La somme a été prélevée sur votre compte « Compte courant Julienne »."],
  ["Prélèvement", "Prélèvement", "Prélèvement de 9,99 € par NETFLIX. La somme a été prélevée sur votre compte « Compte courant Julienne »."],
  ["Remboursement", "Remboursement", "Vous avez été remboursé de 12,30 € par AMAZON EU. La somme a été créditée sur votre compte « Compte courant Julienne »."],
  ["Virement reçu d'un tiers (compte via pied de page)", "Virement reçu", "Vous avez reçu 150 € de Marie Dupont." + FOOTER],
  ["Virement envoyé à un tiers", "Virement", "Vous avez envoyé 40 € à Paul Martin depuis votre compte « Compte courant Julienne »."],
  ["Montant avec milliers et sans décimales", "Paiement", "Vous avez réglé 1 200 € à IKEA avec la carte « Carte Julienne ». La somme a été prélevée sur votre compte « Compte courant Julienne »."],
  ["Paiement refusé (ne doit PAS créer de transaction)", "Carte : solde insuffisant", "Votre paiement de 30 € à FNAC a été refusé : solde insuffisant." + FOOTER],
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
console.log(failures === 0 ? "\nTous les cas passent." : `\n${failures} cas en échec.`);
process.exit(failures === 0 ? 0 : 1);
