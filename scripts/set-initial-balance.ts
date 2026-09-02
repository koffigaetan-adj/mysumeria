/**
 * Définit le solde initial et sa date de référence.
 * Le solde courant sera : soldeInitial + crédits - débits (transactions >= date).
 * Usage : npm run balance:set -- 1234.56 2026-09-01
 * (la date est optionnelle, défaut : maintenant)
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [montantArg, dateArg] = process.argv.slice(2);
  const montant = parseFloat((montantArg ?? "").replace(",", "."));

  if (isNaN(montant)) {
    console.error("Usage : npm run balance:set -- 1234.56 [2026-09-01]");
    process.exit(1);
  }

  const date = dateArg ? new Date(dateArg) : new Date();
  if (isNaN(date.getTime())) {
    console.error(`Date invalide : ${dateArg} (format attendu : AAAA-MM-JJ)`);
    process.exit(1);
  }

  const config = await prisma.accountConfig.upsert({
    where: { id: 1 },
    update: { soldeInitial: montant, soldeInitialDate: date },
    create: { id: 1, soldeInitial: montant, soldeInitialDate: date },
  });

  console.log(
    `✅ Solde initial : ${config.soldeInitial} € au ${config.soldeInitialDate.toISOString().slice(0, 10)}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
