import { useCallback, useEffect, useState } from "react";
import {
  CoursesDtoSchema,
  type CourseDto,
  type CourseInputDto,
} from "@/contexts/bc_arsenal/schemas";
import { errorText, messageOf } from "./apiError";
import type { ApiFetch } from "./useArsenal";

const BASE = "/api/arsenal/courses";

export function useCourses(apiFetch: ApiFetch) {
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const res = await apiFetch(BASE);
    if (!res.ok) throw new Error(await errorText(res));
    const data = CoursesDtoSchema.parse(await res.json());
    setCourses(data.courses);
    setSkipped(data.skipped);
    setError(null);
  }, [apiFetch]);

  useEffect(() => {
    refetch()
      .catch((err) => setError(messageOf(err)))
      .finally(() => setLoading(false));
  }, [refetch]);

  /** Zapis się udał: błąd odświeżenia nie może wyglądać jak błąd zapisu (ponowny zapis dałby duplikat). */
  const refetchAfterWrite = useCallback(
    () => refetch().catch((err) => setError(messageOf(err))),
    [refetch]
  );

  /** Bez `id` tworzy kurs (POST), z `id` zapisuje zmiany (PUT); błąd zapisu rzuca z komunikatem serwera. */
  const save = useCallback(
    async (input: CourseInputDto, id?: string): Promise<void> => {
      const res = await apiFetch(id === undefined ? BASE : `${BASE}/${encodeURIComponent(id)}`, {
        method: id === undefined ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await errorText(res));
      await refetchAfterWrite();
    },
    [apiFetch, refetchAfterWrite]
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const res = await apiFetch(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await errorText(res));
      await refetchAfterWrite();
    },
    [apiFetch, refetchAfterWrite]
  );

  return { courses, skipped, loading, error, save, remove };
}
