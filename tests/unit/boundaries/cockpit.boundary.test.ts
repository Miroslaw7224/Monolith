// @vitest-environment node
/**
 * Granica `bc_cockpit` → `bc_projects` / `bc_tasks` / `bc_calendar` / `bc_inbox` (ASERCJE-3) bez żadnych atrap:
 * `getCockpit` nie woła `lib/github`, a git dają prawdziwe repozytoria z `tempGit` (`local_path` w rejestrze).
 * `lib/git` przyjmuje tylko repozytoria w katalogu domowym, więc na czas testu `HOME` wskazuje katalog
 * tymczasowy, w którym `tempGit` je tworzy (konfiguracja środowiska, nie atrapa).
 */
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCalendarEvent } from "@/contexts/bc_calendar/services";
import { getCockpit } from "@/contexts/bc_cockpit/services";
import { addItem } from "@/contexts/bc_inbox/services";
import { createTask } from "@/contexts/bc_tasks/services";
import { boundaryRegistry, REGISTRY_PATH } from "../helpers/boundaryRegistry";
import { setupTempRepos } from "../helpers/tempGit";
import { setupTempVault } from "../helpers/tempVault";

const vault = setupTempVault();
const repos = setupTempRepos();

const today = new Date(2026, 10, 20, 9, 0);

/** Tablica z jednym zadaniem „Teraz” (`[now::]` w sekcji Next, format `contexts/bc_projects/repositories/tasks-file.ts`). */
const board = (name: string, task: string) =>
  `# Tasks — ${name}\n\n## Next\n\n- [ ] ${task} [now::]\n\n## Backlog\n\n- [ ] Kiedyś\n`;

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(async () => {
  vi.stubEnv("HOME", os.tmpdir());
  const alfa = repos.create();
  const beta = repos.create();
  for (const repo of [alfa, beta]) {
    repo.write("README.md", "x\n");
    repo.commit("start", "2026-11-20");
  }
  vault.write(REGISTRY_PATH, boundaryRegistry(alfa.dir, beta.dir));
  vault.write("Cockpit/pinned.yaml", "projects:\n  - id: alfa\n  - id: beta\n");
  vault.write("Projects/alfa/tasks.md", board("Alfa", "Zadanie alfa"));
  vault.write("Projects/beta/tasks.md", board("Beta", "Zadanie beta"));

  await createTask({ title: "Ogólne", due_date: "2026-11-20" });
  await createCalendarEvent({
    date: "2026-11-20",
    start_minutes: 600,
    duration_minutes: 30,
    title: "Spotkanie",
    tags: [],
    color: "#00802b",
    type: "meeting",
  });
  await addItem("pierwszy");
  await addItem("drugi");
});

describe("granica cockpit ↔ projects / tasks / calendar / inbox", () => {
  it("składa kolejkę, oś dnia, spotkanie, inbox i git z prawdziwych dostawców", async () => {
    const cockpit = await getCockpit(today);

    expect(cockpit.warnings).toEqual([]);
    expect(cockpit.queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          projectId: "alfa",
          items: [expect.objectContaining({ kind: "now", title: "Zadanie alfa" })],
        }),
        expect.objectContaining({
          projectId: null,
          name: "Ogólne",
          items: [expect.objectContaining({ kind: "today", title: "Ogólne", due: "2026-11-20" })],
        }),
      ])
    );
    expect(cockpit.events).toEqual([
      expect.objectContaining({ title: "Spotkanie", startMinutes: 600, type: "meeting" }),
    ]);
    expect(cockpit.nextMeeting).toMatchObject({ date: "2026-11-20", title: "Spotkanie" });
    expect(cockpit.inbox).toEqual({ open: 2 });
    expect(cockpit.git).toEqual({ commitsToday: 2, projectsWithCommits: 2, branch: "main" });
  });

  it("rodzaj i dane firmy z bc_projects: beta etatowa, alfa własna (tematy i kolejka)", async () => {
    const cockpit = await getCockpit(today);

    expect(cockpit.topics.map((t) => [t.id, t.kind, t.companyData])).toEqual([
      ["alfa", "wlasny", false],
      ["beta", "etat", true],
    ]);
    const projectGroups = cockpit.queue.filter((g) => g.projectId !== null);
    expect(projectGroups.map((g) => [g.projectId, g.kind, g.companyData]).sort()).toEqual([
      ["alfa", "wlasny", false],
      ["beta", "etat", true],
    ]);
  });
});
