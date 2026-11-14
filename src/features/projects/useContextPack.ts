"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ContextPackDto } from "@/contexts/bc_projects/schemas";
import type { ContextPackResult } from "./mutation";

export type PackState =
  | { status: "loading" }
  | { status: "ready"; pack: ContextPackDto }
  | { status: "error"; error: string };

/** Wynik ostatniego kopiowania do schowka (pokazywany przy przycisku i w karcie paczki). */
export type CopyNotice =
  | { kind: "copied"; pack: ContextPackDto }
  | { kind: "error"; error: string };

/**
 * Paczka kontekstu wybranego projektu: pobierana przy zmianie projektu (kafel i karta pokazują
 * budżet), a `copy` składa ją od nowa, żeby schowek miał aktualny stan, i kopiuje do schowka.
 */
export function useContextPack(
  projectId: string | null,
  load: () => Promise<ContextPackResult>
): { state: PackState; busy: boolean; notice: CopyNotice | null; copy: () => Promise<void> } {
  const [state, setState] = useState<PackState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<CopyNotice | null>(null);
  /** Numer bieżącego projektu: spóźniona odpowiedź dla poprzedniego nie rusza stanu ani schowka. */
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    const mine = generation.current;
    setNotice(null);
    setBusy(false);
    if (projectId === null) {
      setState({ status: "loading" });
      return;
    }
    setState({ status: "loading" });
    void load().then((result) => {
      if (generation.current !== mine) return;
      setState(
        result.ok === false
          ? { status: "error", error: result.error }
          : { status: "ready", pack: result.pack }
      );
    });
  }, [projectId, load]);

  const copy = useCallback(async () => {
    const mine = generation.current;
    setBusy(true);
    setNotice(null);
    const result = await load();
    if (generation.current !== mine) return;
    if (result.ok === false) {
      setNotice({ kind: "error", error: result.error });
      setBusy(false);
      return;
    }
    setState({ status: "ready", pack: result.pack });
    try {
      await navigator.clipboard.writeText(result.pack.markdown);
      if (generation.current === mine) setNotice({ kind: "copied", pack: result.pack });
    } catch {
      if (generation.current === mine) {
        setNotice({ kind: "error", error: "Nie udało się skopiować do schowka" });
      }
    }
    if (generation.current === mine) setBusy(false);
  }, [load]);

  return { state, busy, notice, copy };
}
