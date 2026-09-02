import PDFDocument from "pdfkit";

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export type PdfTransaction = {
  date: Date;
  montant: number;
  type: "CREDIT" | "DEBIT";
  motif: string | null;
};

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Génère un relevé PDF simple (en-tête, tableau des transactions, solde
 * d'ouverture/clôture). Utilisé pour le téléchargement manuel depuis le
 * dashboard et pour la pièce jointe du relevé mensuel automatique.
 */
export function generateStatementPdf(params: {
  title: string;
  subtitle: string;
  openingBalance: number;
  closingBalance: number;
  transactions: PdfTransaction[];
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 40;
    const right = 555;

    doc.fontSize(18).fillColor("#047857").text(params.title);
    doc.moveDown(0.2);
    doc.fontSize(11).fillColor("#475569").text(params.subtitle);
    doc.moveDown(1);

    doc.fontSize(11).fillColor("#0f172a").text(`Solde d'ouverture : ${EUR.format(params.openingBalance)}`);
    doc.moveDown(1);

    const headerY = doc.y;
    doc.fontSize(9).fillColor("#64748b");
    doc.text("Date", left, headerY, { width: 90 });
    doc.text("Motif", left + 90, headerY, { width: 305 });
    doc.text("Montant", left + 395, headerY, { width: right - left - 395, align: "right" });
    doc.moveDown(0.6);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#e2e8f0").stroke();
    doc.moveDown(0.4);

    if (params.transactions.length === 0) {
      doc.fontSize(10).fillColor("#94a3b8").text("Aucune transaction sur cette période.");
    }

    for (const t of params.transactions) {
      if (doc.y > 760) doc.addPage();
      const rowY = doc.y;
      doc.fontSize(9).fillColor("#334155");
      doc.text(DATE_FMT.format(t.date), left, rowY, { width: 90 });
      doc.text(truncate(t.motif ?? "Motif inconnu", 55), left + 90, rowY, { width: 305 });
      doc.fillColor(t.type === "CREDIT" ? "#047857" : "#dc2626");
      doc.text(`${t.type === "CREDIT" ? "+" : "−"}${EUR.format(t.montant)}`, left + 395, rowY, {
        width: right - left - 395,
        align: "right",
      });
      doc.moveDown(0.6);
    }

    doc.moveDown(0.4);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#e2e8f0").stroke();
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .fillColor("#0f172a")
      .text(`Solde de clôture : ${EUR.format(params.closingBalance)}`, left, doc.y, {
        width: right - left,
        align: "right",
      });

    doc.end();
  });
}
