import nodemailer from "nodemailer";
import { generateStatementPdf } from "@/lib/pdf";

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export type EmailTransaction = {
  date: Date;
  montant: number;
  type: "CREDIT" | "DEBIT";
  motif: string | null;
};

export type SendResult = { ok: true } | { ok: false; error: string };

/** Vrai si l'envoi d'emails est configuré (utilisé pour afficher un avertissement dans Paramètres). */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.GMAIL_SMTP_USER && process.env.GMAIL_APP_PASSWORD);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Envoi via Gmail SMTP avec un "mot de passe d'application" Google (secret distinct
// du refresh token OAuth, qui reste en lecture seule). Limite Gmail : ~500 mails/jour.
function getTransporter() {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("GMAIL_SMTP_USER / GMAIL_APP_PASSWORD manquants : les emails ne sont pas configurés");
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

function fromAddress(): string {
  // Gmail impose l'adresse du compte comme expéditeur, sauf si l'adresse est déclarée
  // en alias dans Gmail ("Envoyer des e-mails en tant que") : NOTIFICATION_FROM permet
  // alors de la forcer. Le nom affiché, lui, est toujours libre.
  return process.env.NOTIFICATION_FROM || `My Sumeria <${process.env.GMAIL_SMTP_USER}>`;
}

function transactionRow(t: EmailTransaction): string {
  const color = t.type === "CREDIT" ? "#1f8f86" : "#dc2626";
  const sign = t.type === "CREDIT" ? "+" : "−";
  return `<tr>
    <td style="padding:8px 4px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#475569;">${DATE_FMT.format(t.date)}</td>
    <td style="padding:8px 4px;border-bottom:1px solid #e2e8f0;font-size:14px;">${escapeHtml(t.motif ?? "Motif inconnu")}</td>
    <td style="padding:8px 4px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:right;color:${color};font-weight:600;white-space:nowrap;">${sign}${EUR.format(t.montant)}</td>
  </tr>`;
}

function wrapEmail(title: string, body: string): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;color:#0f172a;">
    <div style="background:linear-gradient(135deg,#1f8f86,#0a3440);border-radius:16px;padding:20px 24px;color:#fff;">
      <div style="font-family:Georgia,serif;font-size:26px;">My Sumeria</div>
      <div style="font-size:15px;opacity:.9;margin-top:4px;">${title}</div>
    </div>
    <div style="padding:16px 4px;">${body}</div>
    <p style="font-size:12px;color:#94a3b8;">Notification automatique — modifiable dans Paramètres › Alertes.</p>
  </div>`;
}

async function send(payload: {
  to: string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}): Promise<SendResult> {
  try {
    await getTransporter().sendMail({ from: fromAddress(), ...payload });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email] Échec d'envoi :", e);
    return { ok: false, error: msg };
  }
}

/**
 * Notifie d'un ou plusieurs nouveaux mouvements détectés lors d'une synchronisation.
 * Les erreurs sont loguées mais ne font jamais échouer la synchronisation.
 */
export async function sendTransactionNotification(
  to: string[],
  transactions: EmailTransaction[],
  newBalance: number
): Promise<void> {
  if (to.length === 0 || transactions.length === 0) return;

  const subject =
    transactions.length === 1
      ? `${transactions[0].type === "CREDIT" ? "+" : "−"}${EUR.format(transactions[0].montant)} — My Sumeria`
      : `${transactions.length} mouvements — My Sumeria`;

  const html = wrapEmail(
    "Mouvement sur le compte",
    `<table style="width:100%;border-collapse:collapse;">${transactions.map(transactionRow).join("")}</table>
     <p style="margin-top:16px;font-size:14px;color:#475569;">Nouveau solde : <strong>${EUR.format(newBalance)}</strong></p>`
  );

  await send({ to, subject, html });
}

/** Lien de réinitialisation du code (valable 30 min, usage unique). */
export async function sendPasswordResetEmail(to: string, link: string, firstName?: string | null): Promise<SendResult> {
  const html = wrapEmail(
    "Réinitialisation de ton code",
    `<p style="font-size:14px;">${firstName ? `Bonjour ${escapeHtml(firstName)},` : "Bonjour,"}</p>
     <p style="font-size:14px;">Tu as demandé à changer ton code de connexion. Clique sur le bouton ci-dessous — le lien est valable <strong>30 minutes</strong> et ne peut servir qu'une fois.</p>
     <p style="margin:20px 0;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1f8f86;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600;">Choisir un nouveau code</a></p>
     <p style="font-size:12px;color:#64748b;">Si tu n'es pas à l'origine de cette demande, ignore ce mail : ton code actuel reste valable.</p>`
  );
  return send({ to: [to], subject: "Réinitialiser mon code — My Sumeria", html });
}

/** Alerte technique à l'administrateur (synchro en échec, abonnement Gmail non renouvelé…). */
export async function sendAdminAlert(to: string[], subject: string, detail: string): Promise<SendResult> {
  if (to.length === 0) return { ok: false, error: "Aucun administrateur configuré" };
  const html = wrapEmail(
    "Alerte technique",
    `<p style="font-size:14px;">${escapeHtml(subject)}</p>
     <pre style="white-space:pre-wrap;background:#f1f5f9;border-radius:8px;padding:12px;font-size:12px;color:#334155;">${escapeHtml(detail)}</pre>
     <p style="font-size:13px;color:#64748b;">Vérifie les logs Vercel et, si besoin, Paramètres › Administration › Gmail &amp; parseur. Une seule alerte par 24 h.</p>`
  );
  return send({ to, subject: `⚠ ${subject} — My Sumeria`, html });
}

/** Alerte de nouvelle connexion (date, appareil, localisation approximative, IP). */
export async function sendLoginAlert(
  to: string,
  ctx: { date: Date; ip: string; location: string; device: string }
): Promise<void> {
  const when = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(ctx.date);

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 4px;color:#64748b;font-size:14px;white-space:nowrap;">${label}</td>
         <td style="padding:6px 4px;font-size:14px;">${escapeHtml(value)}</td></tr>`;

  const html = wrapEmail(
    "Nouvelle connexion à ton compte",
    `<table style="border-collapse:collapse;">
       ${row("Quand", when)}
       ${row("Appareil", ctx.device)}
       ${row("Localisation", ctx.location)}
       ${row("Adresse IP", ctx.ip)}
     </table>
     <p style="margin-top:16px;font-size:14px;color:#475569;">
       Ce n'était pas toi ? Change ton code immédiatement dans <strong>Paramètres › Profil</strong>.
     </p>`
  );

  await send({ to: [to], subject: `Nouvelle connexion — ${ctx.device} — My Sumeria`, html });
}

/** Envoie un relevé (HTML + PDF joint). Sert au cron mensuel et à l'envoi à la demande. */
export async function sendStatementEmail(
  to: string[],
  params: {
    title: string;
    subtitle: string;
    filename: string;
    openingBalance: number;
    closingBalance: number;
    transactions: EmailTransaction[];
  }
): Promise<SendResult> {
  if (to.length === 0) return { ok: false, error: "Aucun destinataire" };

  const { subtitle, openingBalance, closingBalance, transactions } = params;
  const totalCredits = transactions.filter((t) => t.type === "CREDIT").reduce((s, t) => s + t.montant, 0);
  const totalDebits = transactions.filter((t) => t.type === "DEBIT").reduce((s, t) => s + t.montant, 0);

  const rows =
    transactions.length > 0
      ? transactions.map(transactionRow).join("")
      : `<tr><td colspan="3" style="padding:12px 4px;color:#94a3b8;font-size:14px;">Aucune transaction sur cette période.</td></tr>`;

  const html = wrapEmail(
    `Relevé — ${subtitle}`,
    `<p style="font-size:14px;color:#475569;">Solde d'ouverture : <strong>${EUR.format(openingBalance)}</strong></p>
     <table style="width:100%;border-collapse:collapse;margin-top:8px;">${rows}</table>
     <p style="margin-top:16px;font-size:14px;color:#475569;">
       Total crédits : <strong style="color:#1f8f86;">+${EUR.format(totalCredits)}</strong><br/>
       Total débits : <strong style="color:#dc2626;">−${EUR.format(totalDebits)}</strong>
     </p>
     <p style="margin-top:8px;font-size:16px;">Solde de clôture : <strong>${EUR.format(closingBalance)}</strong></p>
     <p style="font-size:13px;color:#64748b;">Le relevé complet est joint en PDF.</p>`
  );

  let pdf: Buffer;
  try {
    pdf = await generateStatementPdf(params);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email] Échec de génération du PDF :", e);
    return { ok: false, error: `Génération du PDF impossible : ${msg}` };
  }

  return send({
    to,
    subject: `Relevé — ${subtitle} — My Sumeria`,
    html,
    attachments: [{ filename: params.filename, content: pdf }],
  });
}
