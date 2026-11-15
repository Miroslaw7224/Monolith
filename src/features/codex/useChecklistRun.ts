"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChecklistStateDtoSchema,
  type ChecklistStateDto,
  type RunDto,
} from "@/contexts/bc_codex/schemas";
import i18n from "@/src/i18n";
import { checklistProgress } from "./codexFilters";
import type { ApiFetch } from "./useCodex";

export type OwnerZone = "personal" | "work";

type Options = {
  checklist: string | null;
  owner: OwnerZone;
  /** Opis zadania wysyłany w `start` (pierwsza interakcja). */
  task: string;
  /** Identyfikatory punktów wybranej checklisty (do postępu i do `end`). */
  itemIds: string[];
};

const messageOf = (err: unknown): string =>
  err instanceof Error ? err.message : i18n.t("codex:codexErrorGeneric");

async function errorText(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string"
    ? body.error
    : i18n.t("codex:codexErrorStatus", { status: res.status });
}

function blockedMessage(state: ChecklistStateDto | null, owner: OwnerZone): string | null {
  return owner === "work" && state && "blocked" in state.work ? state.work.blocked : null;
}

function openRun(state: ChecklistStateDto | null, owner: OwnerZone, checklist: string | null) {
  if (!state || checklist === null) return undefined;
  const journal = owner === "personal" ? state.personal : state.work;
  if ("blocked" in journal) return undefined;
  return journal.runs.filter((r) => r.checklist === checklist && !r.ended).at(-1);
}

/**
 * Uruchomienie checklisty: stan z `/api/nexus/checklists` i zapis zdarzeń. Uruchomienie powstaje
 * przy pierwszej interakcji (najpierw `start`, potem właściwe zdarzenie); akcje idą jedna po drugiej,
 * żeby szybkie kliknięcia nie utworzyły dwóch uruchomień.
 */
export function useChecklistRun(apiFetch: ApiFetch, { checklist, owner, task, itemIds }: Options) {
  const [state, setState] = useState<ChecklistStateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<ChecklistStateDto | null>(null);
  const tail = useRef<Promise<unknown>>(Promise.resolve());

  const load = useCallback(async (): Promise<ChecklistStateDto | null> => {
    try {
      const res = await apiFetch("/api/nexus/checklists");
      if (!res.ok) throw new Error(await errorText(res));
      const parsed = ChecklistStateDtoSchema.safeParse(await res.json());
      if (!parsed.success)
        throw new Error(i18n.t("codex:codexInvalidResponse", { path: "/api/nexus/checklists" }));
      latest.current = parsed.data;
      setState(parsed.data);
      return parsed.data;
    } catch (err) {
      setError(messageOf(err));
      return latest.current;
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = useCallback(
    async (body: Record<string, unknown>): Promise<{ run: string }> => {
      const res = await apiFetch("/api/nexus/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await errorText(res));
      return (await res.json()) as { run: string };
    },
    [apiFetch]
  );

  const enqueue = useCallback(<T>(job: () => Promise<T>): Promise<T> => {
    const result = tail.current.then(job, job);
    tail.current = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }, []);

  const perform = useCallback(
    (event: (run: string) => Record<string, unknown>, requireRun = false): Promise<boolean> =>
      enqueue(async () => {
        if (checklist === null) return false;
        const known = latest.current ?? (await load());
        const blocked = blockedMessage(known, owner);
        if (blocked) {
          setError(blocked);
          return false;
        }
        try {
          let run = openRun(known, owner, checklist)?.run;
          if (!run) {
            if (requireRun) return false;
            run = (await post({ type: "start", owner, checklist, task })).run;
          }
          await post(event(run));
          setError(null);
          await load();
          return true;
        } catch (err) {
          setError(messageOf(err));
          // `start` mógł się udać mimo błędu dalszych kroków: odśwież stan, żeby kolejna akcja
          // znalazła otwarte uruchomienie zamiast tworzyć drugie.
          await load();
          return false;
        }
      }),
    [enqueue, load, post, checklist, owner, task]
  );

  const toggle = useCallback(
    (item: string, checked: boolean) =>
      perform((run) => ({ type: "toggle", owner, run, item, checked })),
    [perform, owner]
  );

  const setNote = useCallback(
    (item: string, text: string) => perform((run) => ({ type: "note", owner, run, item, text })),
    [perform, owner]
  );

  const end = useCallback(
    () =>
      perform((run) => {
        const current = openRun(latest.current, owner, checklist);
        const progress = checklistProgress(
          itemIds.map((id) => ({ id })),
          current
        );
        return { type: "end", owner, run, done: progress.done, total: progress.total };
      }, true),
    [perform, owner, checklist, itemIds]
  );

  const run: RunDto | undefined = useMemo(
    () => openRun(state, owner, checklist),
    [state, owner, checklist]
  );
  const progress = useMemo(
    () =>
      checklistProgress(
        itemIds.map((id) => ({ id })),
        run
      ),
    [itemIds, run]
  );
  const journal = state ? (owner === "personal" ? state.personal : state.work) : null;
  const readable = journal && !("blocked" in journal) ? journal : null;

  return {
    run,
    progress,
    month: state?.month ?? null,
    eventCount: readable?.eventCount ?? 0,
    skippedLines: readable?.skippedLines ?? 0,
    unterminatedTail: readable?.unterminatedTail ?? false,
    workBlocked: blockedMessage(state, owner),
    error,
    loading,
    toggle,
    setNote,
    end,
    reload: load,
  };
}
