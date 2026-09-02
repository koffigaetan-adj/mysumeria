/**
 * Crée (ou met à jour) un utilisateur autorisé.
 * Usage : npm run user:create -- email@exemple.com 12345678
 * Le PIN (6 ou 8 chiffres, au choix) est hashé avec bcrypt avant stockage ;
 * sa longueur est mémorisée pour afficher le bon nombre de cases à la connexion.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [email, pin] = process.argv.slice(2);

  if (!email || !email.includes("@") || !pin || !/^(\d{6}|\d{8})$/.test(pin)) {
    console.error("Usage : npm run user:create -- email@exemple.com 12345678");
    console.error("Le PIN doit faire 6 ou 8 chiffres.");
    process.exit(1);
  }

  const pinHash = await bcrypt.hash(pin, 10);
  const pinLength = pin.length;
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { pinHash, pinLength, failedAttempts: 0, lockedUntil: null },
    create: { email: email.toLowerCase(), pinHash, pinLength },
  });

  console.log(`✅ Utilisateur créé/mis à jour : ${user.email} (code à ${pinLength} chiffres, id: ${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
