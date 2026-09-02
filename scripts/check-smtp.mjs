/**
 * Vérifie que Gmail accepte GMAIL_SMTP_USER / GMAIL_APP_PASSWORD (sans envoyer de mail).
 * Usage : npm run email:check
 */
import "dotenv/config";
import nodemailer from "nodemailer";

const user = process.env.GMAIL_SMTP_USER;
const pass = process.env.GMAIL_APP_PASSWORD;

if (!user || !pass) {
  console.error("❌ GMAIL_SMTP_USER ou GMAIL_APP_PASSWORD est vide dans .env");
  process.exit(1);
}
console.log(`Compte : ${user} — mot de passe : ${pass.length} caractères`);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user, pass },
});

try {
  await transporter.verify();
  console.log("✅ Gmail accepte ces identifiants. Redémarre `npm run dev` si ce n'est pas déjà fait.");
} catch (e) {
  console.error("❌ Refusé par Gmail :", e.message);
  console.error(
    "\nÀ vérifier :\n" +
      " 1. Le mot de passe d'application a été créé sur le compte " + user + " (pas un autre compte Google).\n" +
      " 2. La validation en deux étapes est active sur ce compte.\n" +
      " 3. Le code fait 16 lettres, copié sans espaces, et n'a pas été révoqué.\n" +
      "Recrée-le si besoin : https://myaccount.google.com/apppasswords"
  );
  process.exit(1);
}
