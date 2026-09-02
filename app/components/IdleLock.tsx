"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isIdleExpired, markActive } from "@/lib/idle";

const CHECK_EVERY_MS = 60 * 1000;
const ACTIVITY_THROTTLE_MS = 30 * 1000;

/** Déconnecte après 30 min sans activité (au retour sur l'appli ou pendant l'usage). */
export default function IdleLock() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login") return;

    let locking = false;
    async function lock() {
      if (locking) return;
      locking = true;
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      window.location.assign("/login?verrouille=1");
    }

    function check() {
      if (isIdleExpired()) {
        lock();
        return;
      }
      markActive();
    }

    let lastTouch = 0;
    function onActivity() {
      const now = Date.now();
      if (now - lastTouch > ACTIVITY_THROTTLE_MS) {
        lastTouch = now;
        markActive();
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") check();
      else markActive();
    }

    check();
    const interval = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", check);
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "scroll"];
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", check);
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
    };
  }, [pathname]);

  return null;
}
