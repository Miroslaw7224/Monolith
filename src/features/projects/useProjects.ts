"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DevlogInputDto,
  ProjectDetailDto,
  ProjectSummaryDto,
  ProjectType,
  StateInputDto,
} from "@/contexts/bc_projects/schemas";
import type { MutationResult, ProjectActions } from "./mutation";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    error?: unknown;
    details?: unknown;
  } | null;
  if (body && typeof body.error === "string" && body.error.length > 0) {
    // 400 z `parseBody` niesie `details` (nazwy pól): bez nich użytkownik widziałby tylko „Validation failed”.
    const fields =
      body.details !== null && typeof body.details === "object" ? Object.keys(body.details) : [];
    return fields.length > 0 ? `${body.error}: ${fields.join(", ")}` : body.error;
  }
  return `HTTP ${res.status}`;
}

export function useProjects(apiFetch: ApiFetch): {
  status: "loading" | "error" | "ready";
  error: string | null;
  projects: ProjectSummaryDto[];
  warnings: string[];
  selectedId: string | null;
  select: (id: string) => void;
  detail: ProjectDetailDto | null;
  detailError: string | null;
} & ProjectActions {
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummaryDto[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetailDto | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  /** Wybrany projekt dla zapisów: aktualizowany synchronicznie (razem ze stanem), nie dopiero w efekcie. */
  const selectedIdRef = useRef<string | null>(null);
  /** Projekt, którego szczegóły są teraz w `detail`; przeładowanie tego samego projektu nie czyści `detail`. */
  const loadedIdRef = useRef<string | null>(null);

  const select = useCallback((id: string) => {
    selectedIdRef.current = id;
    setSelectedId(id);
  }, []);

  const reloadDetail = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  /** Zapis dla wybranego projektu; odpowiedź (pełne szczegóły) zastępuje `detail`, o ile projekt dalej jest wybrany. */
  const mutate = useCallback(
    async (method: string, suffix: string, body: unknown): Promise<MutationResult> => {
      const id = selectedIdRef.current;
      if (id === null) return { ok: false, error: "Nie wybrano projektu", conflict: false };
      try {
        const res = await apiFetch(`/api/projects/${encodeURIComponent(id)}${suffix}`, {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          return { ok: false, error: await readError(res), conflict: res.status === 409 };
        }
        const updated = (await res.json()) as ProjectDetailDto;
        if (selectedIdRef.current === id) setDetail(updated);
        setProjects((list) =>
          list.map((p) =>
            p.id === updated.id
              ? {
                  ...p,
                  freshness: updated.freshness,
                  ...(updated.type !== undefined ? { type: updated.type } : {}),
                }
              : p
          )
        );
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          conflict: false,
        };
      }
    },
    [apiFetch]
  );

  const saveState = useCallback((input: StateInputDto) => mutate("PUT", "/state", input), [mutate]);
  const addDevlogEntry = useCallback(
    (input: DevlogInputDto) => mutate("POST", "/devlog", input),
    [mutate]
  );
  const setType = useCallback((type: ProjectType) => mutate("PATCH", "", { type }), [mutate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/projects");
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          setError(await readError(res));
          return;
        }
        const body = (await res.json()) as {
          projects?: ProjectSummaryDto[];
          warnings?: string[];
        };
        if (cancelled) return;
        const list = Array.isArray(body.projects) ? body.projects : [];
        setProjects(list);
        setWarnings(Array.isArray(body.warnings) ? body.warnings : []);
        setStatus("ready");
        setError(null);
        selectedIdRef.current = list[0]?.id ?? null;
        setSelectedId(list[0]?.id ?? null);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  useEffect(() => {
    if (!selectedId) {
      loadedIdRef.current = null;
      setDetail(null);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    // Zmiana projektu czyści `detail`; ponowne wczytanie tego samego zostawia go do czasu odpowiedzi
    // (odmontowanie teczki skasowałoby niezapisane szkice formularzy).
    if (loadedIdRef.current !== selectedId) {
      loadedIdRef.current = selectedId;
      setDetail(null);
    }
    setDetailError(null);
    (async () => {
      try {
        const res = await apiFetch(`/api/projects/${encodeURIComponent(selectedId)}`);
        if (cancelled) return;
        if (!res.ok) {
          setDetailError(await readError(res));
          setDetail(null);
          return;
        }
        const body = (await res.json()) as ProjectDetailDto;
        if (cancelled) return;
        setDetail(body);
        setDetailError(null);
      } catch (err) {
        if (cancelled) return;
        setDetailError(err instanceof Error ? err.message : String(err));
        setDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, selectedId, reloadKey]);

  return {
    status,
    error,
    projects,
    warnings,
    selectedId,
    select,
    detail,
    detailError,
    saveState,
    addDevlogEntry,
    setType,
    reloadDetail,
  };
}
