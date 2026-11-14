"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapAgentsDtoSchema, type AgentDto } from "@/contexts/bc_map/schemas";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

/** Agenci Herdr: pierwsze wczytanie przy montowaniu, potem ręcznie (`refresh`). Błąd = „niedostępny”. */
export function useMapAgents(apiFetch: ApiFetch): {
  loading: boolean;
  available: boolean;
  agents: AgentDto[];
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<{ loading: boolean; available: boolean; agents: AgentDto[] }>({
    loading: true,
    available: true,
    agents: [],
  });
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    let next = { loading: false, available: false, agents: [] as AgentDto[] };
    try {
      const res = await apiFetch("/api/map/agents");
      if (res.ok) {
        const parsed = MapAgentsDtoSchema.safeParse(await res.json());
        if (parsed.success) next = { loading: false, ...parsed.data };
      }
    } catch {
      /* Herdr niedostępny: panel pokaże komunikat, reszta Mapy działa */
    }
    if (alive.current) setState(next);
  }, [apiFetch]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);

  return { ...state, refresh };
}
