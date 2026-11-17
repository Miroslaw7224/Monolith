/** Surowy nasłuchujący port z jednego źródła (bez reguł domeny). */
export type RawListener = {
  port: number;
  address: string;
  pid: number | null;
  process: string | null;
  path: string | null;
  commandLine: string | null;
};

export type SourceFailureReason = "missing" | "timeout" | "error";

export type SourceResult =
  | { ok: true; listeners: RawListener[] }
  | { ok: false; reason: SourceFailureReason };
