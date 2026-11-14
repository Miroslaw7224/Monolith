"use client";

import { useEffect, useState } from "react";
import { MapGraphDtoSchema, type MapGraphDto } from "@/contexts/bc_map/schemas";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;
type State =
  | { status: "loading"; graph: null; error: null }
  | { status: "ready"; graph: MapGraphDto; error: null }
  | { status: "error"; graph: null; error: string };

/** Graf ładujemy raz (D11); odświeżanie agentów go nie przelicza. */
export function useMapGraph(apiFetch: ApiFetch): State {
  const [state, setState] = useState<State>({ status: "loading", graph: null, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/map/graph");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const parsed = MapGraphDtoSchema.safeParse(await res.json());
        if (!parsed.success) throw new Error("Nieprawidłowa odpowiedź /api/map/graph");
        if (!cancelled) setState({ status: "ready", graph: parsed.data, error: null });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            graph: null,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  return state;
}
