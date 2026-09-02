import { NextRequest, NextResponse } from "next/server";
import { parsePeriode } from "@/lib/period";
import { buildPeriodStatement } from "@/lib/statement";
import { generateStatementPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";

// Protégée par le middleware global (session requise).
export async function GET(request: NextRequest) {
  const statement = await buildPeriodStatement(parsePeriode(request.nextUrl.searchParams.get("periode")));
  const pdf = await generateStatementPdf(statement);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${statement.filename}"`,
    },
  });
}
