import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CatalogDtoSchema,
  DeployInstructionsDtoSchema,
  type ArsenalEntryDto,
  type CatalogDto,
  type DeployInstructionsDto,
  type DeployModeDto,
} from "@/contexts/bc_arsenal/schemas";
import i18n from "@/src/i18n";
import { EMPTY_FILTERS, filterEntries, type ArsenalFilters } from "./arsenalFilters";

export type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

const messageOf = (err: unknown): string =>
  err instanceof Error ? err.message : i18n.t("arsenal:arsenalErrorGeneric");

async function errorText(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string"
    ? body.error
    : i18n.t("arsenal:arsenalErrorStatus", { status: res.status });
}

export function useArsenal(apiFetch: ApiFetch) {
  const [catalog, setCatalog] = useState<CatalogDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ArsenalFilters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    const res = await apiFetch("/api/arsenal");
    if (!res.ok) throw new Error(await errorText(res));
    setCatalog(CatalogDtoSchema.parse(await res.json()));
    setError(null);
  }, [apiFetch]);

  useEffect(() => {
    fetchCatalog()
      .catch((err) => setError(messageOf(err)))
      .finally(() => setLoading(false));
  }, [fetchCatalog]);

  const allEntries = useMemo<ArsenalEntryDto[]>(() => catalog?.entries ?? [], [catalog]);
  const entries = useMemo(() => filterEntries(allEntries, filters), [allEntries, filters]);
  // Wybór użytkownika, a gdy go nie ma lub wypadł z filtra: pierwszy widoczny wpis (jak w makiecie).
  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? entries[0] ?? null,
    [entries, selectedId]
  );

  const fetchInstructions = useCallback(
    async (slug: string, project: string, mode: DeployModeDto): Promise<DeployInstructionsDto> => {
      const url = `/api/arsenal/skills/${encodeURIComponent(slug)}/deploy?project=${encodeURIComponent(project)}&mode=${mode}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(await errorText(res));
      return DeployInstructionsDtoSchema.parse(await res.json());
    },
    [apiFetch]
  );

  const markDeployed = useCallback(
    async (slug: string, project: string, mode: DeployModeDto): Promise<void> => {
      const res = await apiFetch(`/api/arsenal/skills/${encodeURIComponent(slug)}/deployed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, mode }),
      });
      if (!res.ok) throw new Error(await errorText(res));
      try {
        await fetchCatalog();
      } catch (err) {
        // Zapis się udał; błąd odświeżenia nie może zastąpić widoku, więc trafia tylko do wywołującego.
        throw new Error(i18n.t("arsenal:arsenalRefreshFailed", { message: messageOf(err) }));
      }
    },
    [apiFetch, fetchCatalog]
  );

  return {
    loading,
    error,
    total: allEntries.length,
    skipped: catalog?.skipped ?? 0,
    targets: catalog?.targets ?? [],
    allEntries,
    entries,
    filters,
    setFilters,
    selected,
    setSelectedId,
    fetchInstructions,
    markDeployed,
  };
}
