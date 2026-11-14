"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DevlogInputDto,
  NewProjectInputDto,
  ProjectDetailDto,
  ProjectStatusChangeDto,
  ProjectSummaryDto,
  ProjectLinksInputDto,
  ProjectType,
  StateInputDto,
  TaskOpInputDto,
} from "@/contexts/bc_projects/schemas";
import type { ContextPackDto } from "@/contexts/bc_projects/schemas";
import type {
  ContextPackResult,
  CreateProjectResult,
  MutationResult,
  ProjectActions,
} from "./mutation";

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

export function useProjects(
  apiFetch: ApiFetch,
  initialProjectId: string | null = null
): {
  status: "loading" | "error" | "ready";
  error: string | null;
  projects: ProjectSummaryDto[];
  warnings: string[];
  selectedId: string | null;
  select: (id: string) => void;
  detail: ProjectDetailDto | null;
  detailError: string | null;
} & ProjectActions & {
    createProject: (input: NewProjectInputDto) => Promise<CreateProjectResult>;
  } {
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummaryDto[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetailDto | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  /** Wybrany projekt dla zapisów: aktualizowany synchronicznie (razem ze stanem), nie dopiero w efekcie. */
  /** Projekt z „Wejdź” w Kokpicie; czytany tylko przy pierwszym wczytaniu listy. */
  const initialIdRef = useRef(initialProjectId);
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

  /** Zapis dla projektu `id`; odpowiedź (pełne szczegóły) zastępuje `detail`, o ile projekt dalej jest wybrany. */
  const mutateProject = useCallback(
    async (
      id: string | null,
      method: string,
      suffix: string,
      body: unknown
    ): Promise<MutationResult> => {
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
                  status: updated.status,
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

  /** Zapis dla wybranego projektu. */
  const mutate = useCallback(
    (method: string, suffix: string, body: unknown) =>
      mutateProject(selectedIdRef.current, method, suffix, body),
    [mutateProject]
  );

  const saveState = useCallback((input: StateInputDto) => mutate("PUT", "/state", input), [mutate]);
  const addDevlogEntry = useCallback(
    (input: DevlogInputDto) => mutate("POST", "/devlog", input),
    [mutate]
  );
  const setType = useCallback((type: ProjectType) => mutate("PATCH", "", { type }), [mutate]);
  const setLinks = useCallback(
    (links: ProjectLinksInputDto) => mutate("PATCH", "", { links }),
    [mutate]
  );
  const tasksOp = useCallback((input: TaskOpInputDto) => mutate("POST", "/tasks", input), [mutate]);

  const setProjectStatus = useCallback(
    (id: string, status: ProjectStatusChangeDto) => mutateProject(id, "PATCH", "", { status }),
    [mutateProject]
  );

  /** Zakłada projekt w rejestrze (POST), dopisuje go na górę listy i wybiera. */
  const createProject = useCallback(
    async (input: NewProjectInputDto): Promise<CreateProjectResult> => {
      try {
        const res = await apiFetch("/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) return { ok: false, error: await readError(res) };
        const created = (await res.json()) as ProjectDetailDto;
        setProjects((list) => [created, ...list.filter((p) => p.id !== created.id)]);
        selectedIdRef.current = created.id;
        setSelectedId(created.id);
        return { ok: true, id: created.id };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [apiFetch]
  );

  /** Odczyt, nie zapis: poza `mutate`, nie zmienia `detail`. */
  const loadContextPack = useCallback(async (): Promise<ContextPackResult> => {
    const id = selectedIdRef.current;
    if (id === null) return { ok: false, error: "Nie wybrano projektu" };
    try {
      const res = await apiFetch(`/api/projects/${encodeURIComponent(id)}/context-pack`);
      if (!res.ok) return { ok: false, error: await readError(res) };
      return { ok: true, pack: (await res.json()) as ContextPackDto };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, [apiFetch]);

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
        const first =
          (initialIdRef.current && list.find((p) => p.id === initialIdRef.current)?.id) ||
          (list[0]?.id ?? null);
        selectedIdRef.current = first;
        setSelectedId(first);
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
    setLinks,
    setProjectStatus,
    createProject,
    tasksOp,
    loadContextPack,
    reloadDetail,
  };
}
