export class VaultConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultConfigError";
  }
}

type Options = { platform?: NodeJS.Platform };

const WIN_DRIVE = /^([A-Za-z]):[\\/]*(.*)$/;
const MNT_DRIVE = /^\/mnt\/([a-z])(?:\/(.*))?$/;

/** Ścieżka vaulta z `NEXUS_VAULT_PATH` w formie właściwej dla platformy. */
export function resolveVaultRoot(
  env: Record<string, string | undefined>,
  options: Options = {}
): string {
  const platform = options.platform ?? process.platform;
  const raw = (env.NEXUS_VAULT_PATH ?? "").trim();
  if (raw === "") {
    throw new VaultConfigError(
      "Brak vaulta: ustaw NEXUS_VAULT_PATH na bezwzględną ścieżkę do katalogu Vault."
    );
  }

  const win = WIN_DRIVE.exec(raw);
  const mnt = MNT_DRIVE.exec(raw);

  if (platform === "win32") {
    if (mnt) {
      const rest = (mnt[2] ?? "").replace(/\//g, "\\").replace(/\\+$/, "");
      return `${mnt[1].toUpperCase()}:\\${rest}`;
    }
    if (win) return raw.replace(/[\\/]+$/, "");
  } else if (win) {
    const rest = win[2].replace(/\\/g, "/").replace(/\/+$/, "");
    return `/mnt/${win[1].toLowerCase()}/${rest}`;
  } else if (raw.startsWith("/")) {
    return raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
  }

  throw new VaultConfigError(
    `NEXUS_VAULT_PATH musi być ścieżką bezwzględną (bez "~" i ścieżek względnych): ${raw}`
  );
}

/** Odczyt z `process.env`; błąd konfiguracji, gdy zmienna jest pusta. */
export function getVaultRoot(): string {
  return resolveVaultRoot(process.env);
}
