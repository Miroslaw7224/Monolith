import type {
  ContextPackDto,
  DevlogInputDto,
  ProjectType,
  StateInputDto,
  TaskOpInputDto,
} from "@/contexts/bc_projects/schemas";

/** Wynik zapisu z karty Projekty (Save State, devlog, typ); wspólny dla komponentów i `useProjects`. */
export type MutationResult = { ok: true } | { ok: false; error: string; conflict: boolean };

/** Wynik pobrania paczki kontekstu (odczyt, nie zapis). */
export type ContextPackResult = { ok: true; pack: ContextPackDto } | { ok: false; error: string };

/** Akcje zapisu wybranego projektu, przekazywane z `useProjects` do teczki. */
export type ProjectActions = {
  saveState: (input: StateInputDto) => Promise<MutationResult>;
  addDevlogEntry: (input: DevlogInputDto) => Promise<MutationResult>;
  setType: (type: ProjectType) => Promise<MutationResult>;
  /** Operacja na zadaniu tablicy (dodaj, odhacz, edytuj, usuń, przenieś); odpowiedź to pełne szczegóły projektu. */
  tasksOp: (input: TaskOpInputDto) => Promise<MutationResult>;
  /** Składa na serwerze paczkę kontekstu dla agenta (GET, bez zapisu). */
  loadContextPack: () => Promise<ContextPackResult>;
  /** Ponownie pobiera szczegóły wybranego projektu (np. po konflikcie wersji). */
  reloadDetail: () => void;
};
