import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { CATEGORIES } from "@/lib/categories";

function clean(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

// Personnalisation d'une transaction : libellé affiché, note, catégorie.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const data: { label?: string | null; note?: string | null; category?: string | null } = {};
  const label = clean(body.label, 80);
  const note = clean(body.note, 500);
  if (label !== undefined) data.label = label;
  if (note !== undefined) data.note = note;
  if (body.category === null || body.category === "") data.category = null;
  else if (typeof body.category === "string" && (CATEGORIES as readonly string[]).includes(body.category)) {
    data.category = body.category;
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });

  const transaction = await prisma.transaction.update({
    where: { id },
    data,
    select: { id: true, label: true, note: true, category: true },
  });
  return NextResponse.json(transaction);
}
