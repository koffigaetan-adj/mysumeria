export const CATEGORIES = [
  "Abonnements",
  "Courses",
  "Restaurants",
  "Transport",
  "Shopping",
  "Santé",
  "Logement",
  "Virements",
  "Retraits",
  "Autre",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Règles par mots-clés sur le motif (insensible à la casse). Première règle qui matche gagne.
// À enrichir au fil des motifs réels rencontrés dans les relevés.
const RULES: Array<[RegExp, Category]> = [
  [/^virement/i, "Virements"],
  [/retrait|\bdab\b|\batm\b/i, "Retraits"],
  [/netflix|spotify|deezer|anthropic|openai|chatgpt|apple\.com|itunes|icloud|google\s?(one|play|storage)|youtube|canal\+?|disney|prime video|amazon prime|crunchyroll|microsoft|adobe|notion|dropbox/i, "Abonnements"],
  [/carrefour|leclerc|auchan|lidl|aldi|monoprix|intermarch|casino|franprix|super u|\bu express|picard|biocoop|grand frais|naturalia|marche|epicerie/i, "Courses"],
  [/mcdo|mc ?donald|burger|kfc|restaurant|resto|pizza|sushi|kebab|deliveroo|uber ?eats|just eat|starbucks|boulangerie|patisserie|cafe|brasserie|bistro/i, "Restaurants"],
  [/sncf|ratp|navigo|tgv|ouigo|uber(?! ?eats)|bolt|heetch|blablacar|total(?:energies)?|esso|\bbp\b|shell|station|autoroute|vinci|sanef|parking|indigo|air ?france|ryanair|easyjet|transavia|lime|velib/i, "Transport"],
  [/amazon|zara|h ?& ?m|fnac|darty|boulanger|decathlon|ikea|shein|temu|aliexpress|leroy merlin|castorama|action|primark|uniqlo|nike|adidas|sephora|kiabi|cdiscount|vinted/i, "Shopping"],
  [/pharma|doctolib|medecin|docteur|dentiste|mutuelle|hopital|clinique|laboratoire|opticien|optic|kine/i, "Santé"],
  [/loyer|\bedf\b|engie|orange|sfr|\bfree\b|bouygues|sosh|red by|assurance|maif|macif|axa|allianz|veolia|suez|eau de|syndic/i, "Logement"],
];

/** Catégorie d'une transaction : priorité à la catégorie choisie par l'utilisateur, sinon les règles. */
export function categorize(motif: string | null, override?: string | null): Category {
  if (override && (CATEGORIES as readonly string[]).includes(override)) return override as Category;
  if (!motif) return "Autre";
  for (const [pattern, category] of RULES) {
    if (pattern.test(motif)) return category;
  }
  return "Autre";
}
