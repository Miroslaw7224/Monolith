"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PortsResponseSchema, type PortsResponseDto } from "@/contexts/bc_diagnostics/schemas";
import i18n from "@/src/i18n";

export type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

const messageOf = (err: unknown): string =>
  err instanceof Error ? err.message : i18n.t("diagnostics:errorGeneric");

export function useDiagnostics(apiFetch: ApiFetch) {
  const [data, setData] = useState<PortsResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await apiFetch("/api/diagnostics/ports");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(typeof body?.error === "string" ? body.error : `HTTP ${res.status}`);
      }
      const parsed = PortsResponseSchema.parse(await res.json());
      if (!alive.current || mine !== seq.current) return;
      setData(parsed);
      setError(null);
    } catch (err) {
      if (!alive.current || mine !== seq.current) return;
      setError(messageOf(err));
    } finally {
      if (alive.current && mine === seq.current) setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    alive.current = true;
    void reload();
    return () => {
      alive.current = false;
    };
  }, [reload]);

  return { data, error, loading, reload };
}
