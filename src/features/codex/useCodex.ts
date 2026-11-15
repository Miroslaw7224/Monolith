"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CodexDtoSchema } from "@/contexts/bc_codex/schemas";
import i18n from "@/src/i18n";
import type { CodexOk } from "./codexFilters";

export type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

export type CodexLoad =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "missing"; path: string }
  | { status: "config-error"; message: string }
  | { status: "ok"; data: CodexOk };

export type ReloadOutcome = "changed" | "same" | "error";

const messageOf = (err: unknown): string =>
  err instanceof Error ? err.message : i18n.t("codex:codexErrorGeneric");

async function errorText(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string"
    ? body.error
    : i18n.t("codex:codexErrorStatus", { status: res.status });
}

function sameState(a: CodexLoad, b: CodexLoad): boolean {
  if (a.status !== b.status) return false;
  if (a.status === "ok" && b.status === "ok") {
    return a.data.mtimeMs === b.data.mtimeMs && a.data.path === b.data.path;
  }
  if (a.status === "missing" && b.status === "missing") return a.path === b.path;
  if (a.status === "config-error" && b.status === "config-error") return a.message === b.message;
  if (a.status === "error" && b.status === "error") return a.message === b.message;
  return a.status === "loading";
}

/**
 * Kodeks z `/api/nexus/codex`. Odświeża się co `pollMs` oraz po powrocie do karty/okna; przy
 * niezmienionym `mtime` zostawia ten sam obiekt stanu (bez migotania). Błąd odpytywania przy
 * już wczytanych danych zostawia ostatnie znane dane.
 */
export function useCodex(
  apiFetch: ApiFetch,
  pollMs = 15_000
): { state: CodexLoad; reload: () => Promise<ReloadOutcome> } {
  const [state, setState] = useState<CodexLoad>({ status: "loading" });
  const current = useRef<CodexLoad>(state);
  const alive = useRef(true);

  const apply = useCallback((next: CodexLoad): ReloadOutcome => {
    if (sameState(current.current, next)) return "same";
    current.current = next;
    if (alive.current) setState(next);
    return "changed";
  }, []);

  const reload = useCallback(async (): Promise<ReloadOutcome> => {
    try {
      const res = await apiFetch("/api/nexus/codex");
      if (!res.ok) throw new Error(await errorText(res));
      const parsed = CodexDtoSchema.safeParse(await res.json());
      if (!parsed.success)
        throw new Error(i18n.t("codex:codexInvalidResponse", { path: "/api/nexus/codex" }));
      const dto = parsed.data;
      if (dto.status === "ok") return apply({ status: "ok", data: dto });
      if (dto.status === "missing") return apply({ status: "missing", path: dto.path });
      return apply({ status: "config-error", message: dto.message });
    } catch (err) {
      if (current.current.status === "ok") return "error";
      apply({ status: "error", message: messageOf(err) });
      return "error";
    }
  }, [apiFetch, apply]);

  useEffect(() => {
    alive.current = true;
    void reload();
    const timer = setInterval(() => void reload(), pollMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      alive.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [reload, pollMs]);

  return { state, reload };
}
