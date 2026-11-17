export type SourceName = "wsl" | "windows";
export type SourceFailure = "missing" | "timeout" | "error";
export type Exposure = "local" | "network";
export type PortWarning = "self" | "system";

/** Wiersz ze źródła, przed regułami domeny. */
export type SourceEntry = {
  source: SourceName;
  port: number;
  address: string;
  pid: number | null;
  process: string;
  path: string | null;
  commandLine: string | null;
};

export type SourceRead =
  | { ok: true; entries: SourceEntry[] }
  | { ok: false; reason: SourceFailure };

export type PortListener = SourceEntry & {
  exposure: Exposure;
  warning: PortWarning | null;
  killCommand: string | null;
};

export type SourceStatus = { ok: true } | { ok: false; reason: SourceFailure };

export type PortsSnapshot = {
  generatedAt: string;
  sources: Record<SourceName, SourceStatus>;
  ports: PortListener[];
};
