import { useEffect, useState } from "react";

/** Liczba otwartych wpisów Inboxu (`GET /api/inbox` → `open`); `null` = brak danych. */
export function useInboxOpen(
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>,
  enabled: boolean
): number | null {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/inbox");
        if (!res.ok) throw new Error(`inbox ${res.status}`);
        const data = (await res.json()) as { open?: unknown };
        if (!cancelled) setOpen(typeof data.open === "number" ? data.open : null);
      } catch {
        if (!cancelled) setOpen(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, enabled]);

  return open;
}
