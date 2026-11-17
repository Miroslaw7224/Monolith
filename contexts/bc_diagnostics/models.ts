export type SourceName = "wsl" | "windows";
export type SourceFailure = "missing" | "timeout" | "error";
export type Exposure = "local" | "network";
export type PortWarning = "self";

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

/** Jeden proces na jednym porcie; adresy IPv4/IPv6 są scalone w `addresses`. */
export type PortListener = Omit<SourceEntry, "address"> & {
  addresses: string[];
  exposure: Exposure;
  warning: PortWarning | null;
  killCommand: string | null;
  /** Czy to port „aplikacyjny” (proces dev, serwer Monolith, nienazwany ≥1024); reszta ukryta domyślnie. */
  relevant: boolean;
};

export type SourceStatus = { ok: true } | { ok: false; reason: SourceFailure };

export type PortsSnapshot = {
  generatedAt: string;
  sources: Record<SourceName, SourceStatus>;
  ports: PortListener[];
};
