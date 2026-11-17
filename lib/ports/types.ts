/** Proces w drzewie przodków (nazwa z `/proc/<pid>/comm`). */
export type ProcessRef = { pid: number; name: string };

/** Surowy nasłuchujący port z jednego źródła (bez reguł domeny). */
export type RawListener = {
  port: number;
  address: string;
  pid: number | null;
  process: string | null;
  path: string | null;
  commandLine: string | null;
  /** Katalog roboczy procesu (tylko WSL, z `/proc/<pid>/cwd`); do dopasowania projektu. */
  cwd: string | null;
  /** Przodkowie od najbliższego rodzica w górę (tylko WSL); dla Windows `[]`. */
  ancestors: ProcessRef[];
};

export type SourceFailureReason = "missing" | "timeout" | "error";

export type SourceResult =
  | { ok: true; listeners: RawListener[] }
  | { ok: false; reason: SourceFailureReason };
