import type {
  DevlogInputDto,
  ProjectType,
  StateInputDto,
  TaskOpInputDto,
} from "@/contexts/bc_projects/schemas";

/** Wynik zapisu z karty Projekty (Save State, devlog, typ); wspólny dla komponentów i `useProjects`. */
export type MutationResult = { ok: true } | { ok: false; error: string; conflict: boolean };

/** Akcje zapisu wybranego projektu, przekazywane z `useProjects` do teczki. */
export type ProjectActions = {
  saveState: (input: StateInputDto) => Promise<MutationResult>;
  addDevlogEntry: (input: DevlogInputDto) => Promise<MutationResult>;
  setType: (type: ProjectType) => Promise<MutationResult>;
  /** Operacja na zadaniu tablicy (dodaj, odhacz, edytuj, usuń, przenieś); odpowiedź to pełne szczegóły projektu. */
  tasksOp: (input: TaskOpInputDto) => Promise<MutationResult>;
  /** Ponownie pobiera szczegóły wybranego projektu (np. po konflikcie wersji). */
  reloadDetail: () => void;
};
