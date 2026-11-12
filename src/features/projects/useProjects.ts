"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProjectDetailDto, ProjectSummaryDto } from "@/contexts/bc_projects/schemas";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  if (body && typeof body.error === "string" && body.error.length > 0) {
    return body.error;
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
} {
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummaryDto[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetailDto | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const select = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

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
      setDetail(null);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
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
  }, [apiFetch, selectedId]);

  return {
    status,
    error,
    projects,
    warnings,
    selectedId,
    select,
    detail,
    detailError,
  };
}
