"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, XIcon } from "@/app/components/Icons";

export default function SearchBox({ periode, initialQuery }: { periode: string; initialQuery: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  function navigate(value: string) {
    const params = new URLSearchParams();
    if (periode !== "mois") params.set("periode", periode);
    if (value.trim()) params.set("q", value.trim());
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        navigate(q);
      }}
      className="relative"
    >
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-900/40 dark:text-white/40">
        <SearchIcon className="h-4 w-4" />
      </span>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher un motif…"
        className="w-full rounded-full border border-ink-900/10 bg-white py-2.5 pl-10 pr-10 text-sm outline-none placeholder:text-ink-900/40 focus:border-brand-500 dark:border-white/10 dark:bg-ink-800 dark:placeholder:text-white/40"
      />
      {q && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            navigate("");
          }}
          aria-label="Effacer la recherche"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-900/50 hover:text-ink-900 dark:text-white/50 dark:hover:text-white"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
