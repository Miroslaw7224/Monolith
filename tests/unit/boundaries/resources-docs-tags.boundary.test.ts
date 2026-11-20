// @vitest-environment node
/**
 * Granica `bc_resources` → `bc_nexus_docs` / `bc_tags` (ASERCJE-3). Jedyna atrapa to sieć: `addResource` zawsze
 * pobiera tytuł strony przez `fetch`. Most zasób → notatka i słownik tagów idą przez prawdziwe serwisy dostawców
 * w tymczasowym vaulcie.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addResource, getResources } from "@/contexts/bc_resources/services";
import { getUserTags } from "@/contexts/bc_tags/services";
import { boundaryRegistry, REGISTRY_PATH } from "../helpers/boundaryRegistry";
import { setupTempVault } from "../helpers/tempVault";

const vault = setupTempVault();

/** Słownik z tagiem `Narzędzia` i synonimem `tool`. */
const TAGS = [
  "version: 1",
  "tags:",
  "  - id: AAAAAAAAAAAAAAAAAAAA",
  "    tag: Narzędzia",
  "    title: Narzędzia",
  "    aliases:",
  "      - tool",
  '    created: "2026-11-01T00:00:00.000Z"',
  "",
].join("\n");

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(
      async () =>
        new Response("<html><head><title>Strona</title></head></html>", {
          headers: { "content-type": "text/html" },
        })
    )
  );
  vault.write(REGISTRY_PATH, boundaryRegistry("/tmp/alfa", "/tmp/beta"));
  vault.write(
    "Knowledge/narzedzia.md",
    "---\ntitle: Narzędzia\nsource_urls:\n  - https://www.example.com/docs\n---\nTreść\n"
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("granica resources ↔ nexus_docs / tags", () => {
  it("zasób dostaje ścieżkę notatki Knowledge/ z bc_nexus_docs (www. zrównane)", async () => {
    await addResource({ description: "d", url: "https://example.com/x" });

    expect(await getResources()).toEqual([
      expect.objectContaining({
        url: "https://example.com/x",
        title: "Strona",
        notePath: "Knowledge/narzedzia.md",
      }),
    ]);
  });

  it("synonim tagu zasobu zapisuje się jako nazwa kanoniczna z bc_tags", async () => {
    vault.write("Resources/tags.yaml", TAGS);

    await addResource({ description: "d", url: "https://other.org/", tags: ["tool"] });

    expect(await getResources()).toEqual([expect.objectContaining({ tags: ["Narzędzia"] })]);
    expect((await getUserTags()).map((t) => t.tag)).toEqual(["Narzędzia"]);
  });
});
