/**
 * Rejestr projektów do testów granic (`tests/unit/boundaries`): `alfa` własny (`owner: personal`)
 * i `beta` etatowy (`owner: work`). Format: `docs/nexus-vault-formaty-yaml.md`.
 */
export const REGISTRY_PATH = "Projects/_registry.yaml";

export const boundaryRegistry = (alfaPath: string, betaPath: string): string =>
  [
    "projects:",
    "  - id: alfa",
    "    name: Alfa",
    "    status: active",
    "    priority: high",
    "    folder: Projects/alfa/",
    "    owner: personal",
    `    local_path: '${alfaPath}'`,
    "  - id: beta",
    "    name: Beta",
    "    status: active",
    "    priority: medium",
    "    folder: Projects/beta/",
    "    owner: work",
    `    local_path: '${betaPath}'`,
    "",
  ].join("\n");
