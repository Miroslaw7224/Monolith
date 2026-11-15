"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ContextPackDto, ContextPackRole } from "@/contexts/bc_projects/schemas";
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
 * Paczka kontekstu wybranego projektu i roli: pobierana przy zmianie projektu albo roli (kafel i karta
 * pokazują budżet), a `copy` składa ją od nowa, żeby schowek miał aktualny stan, i kopiuje do schowka.
 * Rola jest powiązana z projektem: po zmianie projektu wraca do `full` (bez dodatkowego pobrania).
 */
export function useContextPack(
  projectId: string | null,
  load: (role: ContextPackRole) => Promise<ContextPackResult>
): {
  state: PackState;
  busy: boolean;
  notice: CopyNotice | null;
  copy: () => Promise<void>;
  role: ContextPackRole;
  setRole: (role: ContextPackRole) => void;
} {
  const [state, setState] = useState<PackState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<CopyNotice | null>(null);
  const [pick, setPick] = useState<{ id: string | null; role: ContextPackRole }>({
    id: null,
    role: "full",
  });
  const role: ContextPackRole = pick.id === projectId ? pick.role : "full";
  const setRole = useCallback(
    (next: ContextPackRole) => setPick({ id: projectId, role: next }),
    [projectId]
  );
  // Rola należy do projektu: po zmianie projektu `pick` wraca do `full`, więc powrót do poprzedniego
  // projektu nie przywraca starej roli. `role` jest już wtedy `full`, więc bez dodatkowego pobrania.
  useEffect(() => {
    setPick((p) => (p.id === projectId ? p : { id: projectId, role: "full" }));
  }, [projectId]);
  /** Numer bieżącego żądania (projekt, rola): spóźniona odpowiedź nie rusza stanu ani schowka. */
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
    void load(role).then((result) => {
      if (generation.current !== mine) return;
      setState(
        result.ok === false
          ? { status: "error", error: result.error }
          : { status: "ready", pack: result.pack }
      );
    });
  }, [projectId, load, role]);

  const copy = useCallback(async () => {
    const mine = generation.current;
    setBusy(true);
    setNotice(null);
    const result = await load(role);
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
  }, [load, role]);

  return { state, busy, notice, copy, role, setRole };
}
