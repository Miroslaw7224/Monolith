import React, { useEffect, useRef, useState } from "react";
import { useT } from "@/src/i18n/useT";

type Props = {
  text: string;
  label?: string;
  /** Pełna nazwa dla czytników ekranu, gdy `label` jest skrócony. */
  ariaLabel?: string;
  primary?: boolean;
};

export function CopyButton({ text, label, ariaLabel, primary = false }: Props) {
  const t = useT();
  const copyLabel = label ?? t("arsenal:arsenalCopy");
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    []
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), 1500);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };
  return (
    <button
      type="button"
      className={primary ? "asv-btn asv-btn--primary" : "asv-btn"}
      aria-label={done ? undefined : ariaLabel}
      onClick={copy}
    >
      {done ? t("arsenal:arsenalCopied") : copyLabel}
    </button>
  );
}
