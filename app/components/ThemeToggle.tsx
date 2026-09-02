"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@/app/components/Icons";

type Theme = "dark" | "light";
const STORAGE_KEY = "sumeria-theme";

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // simple confort, pas bloquant si le stockage échoue
    }
    setTheme(next);
  }

  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full items-center justify-between py-1"
      aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      <span className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-200">
          {dark ? <MoonIcon /> : <SunIcon />}
        </span>
        <span className="text-sm font-medium">{dark ? "Mode sombre" : "Mode clair"}</span>
      </span>
      <span className="switch" data-on={dark} />
    </button>
  );
}
