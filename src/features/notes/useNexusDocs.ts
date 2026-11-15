import { useEffect, useState } from "react";
import type { NexusDocDto, NexusDocSummaryDto } from "@/contexts/bc_nexus_docs/schemas";
import i18n from "@/src/i18n";

export type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

function nexusListError(): string {
  return i18n.t("notes:notesNexusListError");
}

function nexusDocError(): string {
  return i18n.t("notes:notesNexusDocError");
}

/** Lista dokumentów NEXUS (jedno zapytanie, bez treści). Bez `apiFetch` nic nie pobiera. */
export function useNexusDocs(apiFetch: ApiFetch | undefined): {
  docs: NexusDocSummaryDto[];
  error: string | null;
} {
  const [docs, setDocs] = useState<NexusDocSummaryDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiFetch) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/nexus-docs");
        const data: unknown = await res.json();
        if (cancelled) return;
        if (!res.ok || !Array.isArray(data)) {
          setDocs([]);
          setError(nexusListError());
          return;
        }
        setDocs(data as NexusDocSummaryDto[]);
        setError(null);
      } catch {
        if (cancelled) return;
        setDocs([]);
        setError(nexusListError());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  return { docs, error };
}

/** Treść jednego dokumentu po otwarciu. `path` = ścieżka względem vaulta albo `null`. */
export function useNexusDoc(
  apiFetch: ApiFetch,
  path: string | null
): { doc: NexusDocDto | null; loading: boolean; error: string | null } {
  const [doc, setDoc] = useState<NexusDocDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDoc(null);
    setError(null);
    if (path === null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const url = `/api/nexus-docs/${path.split("/").map(encodeURIComponent).join("/")}`;
        const res = await apiFetch(url);
        const data: unknown = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(nexusDocError());
        } else {
          setDoc(data as NexusDocDto);
        }
      } catch {
        if (!cancelled) setError(nexusDocError());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, path]);

  return { doc, loading, error };
}
