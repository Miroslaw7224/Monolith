"use client";

import { useEffect, useRef, useState } from "react";
import type { CodeSyncDto, ProjectDetailDto } from "@/contexts/bc_projects/schemas";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

/**
 * Stany kart względem repo po `id`, pobierane osobno od listy projektów (lista nie czeka na git).
 * Błąd sieci albo HTTP zostawia pustą mapę: znaczniki są dodatkiem i nie psują listy. Wpis wybranego
 * projektu odświeża się z jego szczegółów (np. po „Oznacz jako zaktualizowaną”).
 */
export function useCodeSync(
  apiFetch: ApiFetch,
  enabled: boolean,
  detail: ProjectDetailDto | null
): Record<string, CodeSyncDto> {
  const [map, setMap] = useState<Record<string, CodeSyncDto>>({});
  // Wpisy ze szczegółów są świeższe niż mapa: spóźniona odpowiedź GET ich nie nadpisuje.
  const fromDetail = useRef<Record<string, CodeSyncDto>>({});

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch("/api/projects/code-sync");
        if (!res.ok) return;
        const body = (await res.json()) as { codeSync?: Record<string, CodeSyncDto> };
        if (!cancelled && body.codeSync) setMap({ ...body.codeSync, ...fromDetail.current });
      } catch {
        // brak znaczników zamiast błędu listy
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, enabled]);

  const id = detail?.id;
  const sync = detail?.codeSync;
  useEffect(() => {
    if (!id || !sync) return;
    fromDetail.current[id] = sync;
    setMap((m) => ({ ...m, [id]: sync }));
  }, [id, sync]);

  return map;
}
