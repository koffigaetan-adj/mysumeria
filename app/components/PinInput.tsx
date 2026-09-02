"use client";

import { useEffect, useRef } from "react";

export default function PinInput({
  length,
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus = true,
}: {
  length: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  // Focus la première case au chargement et à chaque remise à zéro (ex: après une erreur)
  useEffect(() => {
    if (autoFocus && value === "") refs.current[0]?.focus();
  }, [value, autoFocus]);

  function setDigitAt(index: number, digit: string) {
    const chars = value.split("");
    chars[index] = digit;
    const next = chars.join("").slice(0, length);
    onChange(next);

    if (digit && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
    if (next.length === length) {
      onComplete?.(next);
    }
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (digit) setDigitAt(index, digit);
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (value[index]) {
        setDigitAt(index, "");
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
        setDigitAt(index - 1, "");
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (digits.length === 0) return;
    e.preventDefault();
    onChange(digits);
    refs.current[Math.min(digits.length, length - 1)]?.focus();
    if (digits.length === length) onComplete?.(digits);
  }

  return (
    <div className="flex justify-center gap-1.5">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className="h-14 w-9 rounded-xl border border-ink-900/10 bg-white text-center text-2xl outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 sm:w-10 dark:border-white/10 dark:bg-ink-800"
        />
      ))}
    </div>
  );
}
