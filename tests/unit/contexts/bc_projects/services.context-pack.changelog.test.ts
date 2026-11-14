// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildContextPack } from "@/contexts/bc_projects/services";
import { setupTempVault } from "../../helpers/tempVault";

const vault = setupTempVault();
const TODAY = new Date(2026, 10, 14, 12, 0);

describe("paczka kontekstu a changelog.md", () => {
  it("jest identyczna z changelog.md i bez niego", () => {
    vault.write(
      "Projects/_registry.yaml",
      "projects:\n  - id: demo\n    name: Demo\n    status: active\n    priority: high\n    folder: Projects/demo/\n    local_path: /nonexistent/demo\n"
    );
    vault.write("Projects/demo/index.md", "# Demo\n");
    vault.write("Projects/demo/tasks.md", "## Next\n\n- [ ] Otwarte [now::]\n");
    const without = buildContextPack("demo", TODAY);
    vault.write(
      "Projects/demo/changelog.md",
      "# Changelog — Demo\n\n## 2026-11\n\n- [x] SENTINEL-CHANGELOG — 2026-11-01\n"
    );
    const withChangelog = buildContextPack("demo", TODAY);
    expect(withChangelog).toEqual(without);
    expect(withChangelog.markdown).not.toContain("SENTINEL-CHANGELOG");
  });
});
