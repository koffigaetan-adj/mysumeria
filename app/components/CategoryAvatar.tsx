import type { Category } from "@/lib/categories";

type IconProps = { className?: string };

function Icon({ className = "h-4 w-4", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  );
}

const ICONS: Record<Exclude<Category, "Autre">, React.ReactNode> = {
  Abonnements: (
    <Icon>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </Icon>
  ),
  Courses: (
    <Icon>
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </Icon>
  ),
  Restaurants: (
    <Icon>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </Icon>
  ),
  Transport: (
    <Icon>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </Icon>
  ),
  Shopping: (
    <Icon>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </Icon>
  ),
  Santé: (
    <Icon>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </Icon>
  ),
  Logement: (
    <Icon>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </Icon>
  ),
  Virements: (
    <Icon>
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </Icon>
  ),
  Retraits: (
    <Icon>
      <rect width="20" height="12" x="2" y="6" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </Icon>
  ),
};

// Teintes par catégorie : identité visuelle, jamais le sens crédit/débit (porté par le montant et le badge).
const STYLES: Record<Category, string> = {
  Abonnements: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  Courses: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Restaurants: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  Transport: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  Shopping: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  Santé: "bg-lime-500/15 text-lime-700 dark:text-lime-300",
  Logement: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  Virements: "bg-brand-500/15 text-brand-700 dark:text-brand-200",
  Retraits: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  Autre: "bg-ink-900/10 text-ink-900/70 dark:bg-white/10 dark:text-white/70",
};

/**
 * Pastille d'une transaction : icône de catégorie (débit) ou initiale, avec un
 * petit badge ↓/↑ qui porte le sens du mouvement.
 */
export default function CategoryAvatar({
  category,
  name,
  type,
}: {
  category: Category;
  name: string;
  type: "CREDIT" | "DEBIT";
}) {
  const credit = type === "CREDIT";
  const style = credit ? "bg-brand-500/15 text-brand-700 dark:text-brand-200" : STYLES[category];
  const initial = name.replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toUpperCase() || "?";
  const icon = !credit && category !== "Autre" ? ICONS[category] : <span className="text-sm font-semibold">{initial}</span>;

  return (
    <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style}`}>
      {icon}
      <span
        className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white dark:ring-ink-800 ${
          credit ? "bg-brand-600" : "bg-red-500"
        }`}
        aria-label={credit ? "Crédit" : "Débit"}
      >
        {credit ? "↓" : "↑"}
      </span>
    </span>
  );
}
