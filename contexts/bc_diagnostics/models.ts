export type SourceName = "wsl" | "windows";
export type SourceFailure = "missing" | "timeout" | "error";
export type Exposure = "local" | "network";
export type PortWarning = "self";
export type Role = "frontend" | "backend";

/** Proces w drzewie przodków (nazwa z `/proc/<pid>/comm`). */
export type ProcessRef = { pid: number; name: string };

/** Wiersz ze źródła, przed regułami domeny. */
export type SourceEntry = {
  source: SourceName;
  port: number;
  address: string;
  pid: number | null;
  process: string;
  path: string | null;
  commandLine: string | null;
  /** Katalog roboczy procesu (WSL); nie trafia do DTO, służy do dopasowania projektu. */
  cwd: string | null;
  /** Przodkowie od najbliższego rodzica w górę (WSL); nie trafia do DTO. */
  ancestors: ProcessRef[];
};

export type SourceRead =
  | { ok: true; entries: SourceEntry[] }
  | { ok: false; reason: SourceFailure };

/** Jeden proces na jednym porcie; adresy IPv4/IPv6 są scalone w `addresses`. */
export type PortListener = Omit<SourceEntry, "address" | "cwd" | "ancestors"> & {
  /** `źródło|PID|port`: stały klucz wiersza. */
  id: string;
  addresses: string[];
  /** Rola w aplikacji (z podkatalogu projektu albo z komendy); tylko dla procesów z projektem. */
  role: Role | null;
  /** Rodzic to systemd/init: proces projektu został po zakończeniu uruchamiającego go procesu. */
  orphan: boolean;
  /** Projekt NEXUS, w którego katalogu działa proces; `null` dla nieznanych i projektów etatowych. */
  project: { id: string; name: string } | null;
  exposure: Exposure;
  warning: PortWarning | null;
  killCommand: string | null;
  /** Czy to port „aplikacyjny” (proces dev, serwer Monolith, nienazwany ≥1024); reszta ukryta domyślnie. */
  relevant: boolean;
};

export type SourceStatus = { ok: true } | { ok: false; reason: SourceFailure };

/** Procesy jednego projektu: wspólny rodzic (np. `concurrently`) i rola, której brakuje. */
export type PortGroup = {
  projectId: string;
  launcher: ProcessRef | null;
  missingRole: Role | null;
};

export type PortsSnapshot = {
  generatedAt: string;
  sources: Record<SourceName, SourceStatus>;
  ports: PortListener[];
  groups: PortGroup[];
};
