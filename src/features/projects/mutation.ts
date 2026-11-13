/** Wynik zapisu z karty Projekty (Save State, devlog, typ); wspólny dla komponentów i `useProjects`. */
export type MutationResult = { ok: true } | { ok: false; error: string; conflict: boolean };
