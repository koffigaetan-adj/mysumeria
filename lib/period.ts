export type Periode = "mois" | "30j" | "tout";

export const PERIODE_LABELS: Record<Periode, string> = {
  mois: "Ce mois-ci",
  "30j": "30 derniers jours",
  tout: "Historique complet",
};

export function parsePeriode(value: string | undefined | null): Periode {
  return value === "30j" || value === "tout" ? value : "mois";
}

export function periodeStart(periode: Periode): Date | undefined {
  const now = new Date();
  if (periode === "mois") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (periode === "30j") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return undefined;
}
