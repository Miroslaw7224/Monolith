import { useCallback, useEffect, useRef, useState } from "react";
import type { TaskPatch } from "./useTasksBoard";

export type DraftState = "idle" | "saving" | "saved" | "error";

export interface DraftFields {
  title: string;
  link: string;
  description: string;
}

const KEYS = ["title", "link", "description"] as const;

/** Tylko pola zmienione względem ostatnio zapisanych (po przycięciu); pusty tytuł się nie zapisuje. */
export function buildDraftPatch(
  values: DraftFields,
  saved: DraftFields
): Pick<TaskPatch, "title" | "link" | "description"> {
  const patch: Partial<DraftFields> = {};
  for (const key of KEYS) {
    const next = values[key].trim();
    if (key === "title" && next === "") continue;
    if (next !== saved[key].trim()) patch[key] = next;
  }
  return patch;
}

interface Options {
  taskId: string;
  initial: DraftFields;
  save: (taskId: string, patch: TaskPatch) => Promise<void>;
  delayMs?: number;
}

/**
 * Szkic pól tekstowych zadania z autozapisem. Komponent ma być montowany z `key={taskId}`:
 * odmontowanie (zamknięcie, zmiana zadania) zapisuje oczekującą zmianę.
 */
export function useTaskDraft({ taskId, initial, save, delayMs = 1500 }: Options) {
  const [values, setValues] = useState<DraftFields>(initial);
  const [state, setState] = useState<DraftState>("idle");
  const valuesRef = useRef(values);
  const savedRef = useRef<DraftFields>(initial);
  const saveRef = useRef(save);
  const idRef = useRef(taskId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  saveRef.current = save;
  idRef.current = taskId;

  const failedRef = useRef(false);

  /** `isDraft`: zapis szkicu tekstowego; jego porażka zostaje widoczna mimo późniejszych udanych zapisów jednopolowych. */
  const run = useCallback(
    async (patch: TaskPatch, onOk?: () => void, isDraft = false): Promise<boolean> => {
      setState("saving");
      try {
        await saveRef.current(idRef.current, patch);
        onOk?.();
        if (isDraft) failedRef.current = false;
        setState(failedRef.current ? "error" : "saved");
        return true;
      } catch {
        if (isDraft) failedRef.current = true;
        setState("error");
        return false;
      }
    },
    []
  );

  const flush = useCallback((): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    chainRef.current = chainRef.current.then(async () => {
      const patch = buildDraftPatch(valuesRef.current, savedRef.current);
      if (Object.keys(patch).length === 0) return;
      await run(
        patch,
        () => {
          savedRef.current = { ...savedRef.current, ...patch };
        },
        true
      );
    });
    return chainRef.current;
  }, [run]);

  /** Jednopolowy zapis od razu; `false`, gdy się nie udał (wywołujący cofa wartość w polu). */
  const saveNow = useCallback(
    (patch: TaskPatch): Promise<boolean> => {
      const result = chainRef.current.then(() => run(patch));
      chainRef.current = result.then(() => undefined);
      return result;
    },
    [run]
  );

  const setField = useCallback(
    (key: keyof DraftFields, value: string) => {
      const next = { ...valuesRef.current, [key]: value };
      valuesRef.current = next;
      setValues(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, delayMs);
    },
    [delayMs, flush]
  );

  useEffect(
    () => () => {
      void flush();
    },
    [flush]
  );

  return { values, setField, state, flush, saveNow, titleEmpty: values.title.trim() === "" };
}
