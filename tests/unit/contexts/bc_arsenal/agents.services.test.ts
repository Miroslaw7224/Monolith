// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  readAgentEntries: vi.fn(),
  insertAgentEntry: vi.fn(),
  replaceAgentEntry: vi.fn(),
  deleteAgentEntry: vi.fn(),
}));
vi.mock("@/contexts/bc_arsenal/repositories", () => ({
  readPromptFiles: vi.fn(),
  readSkillFiles: vi.fn(),
  readTemplates: vi.fn(),
  writeDeployed: vi.fn(),
  readCourses: vi.fn(),
  insertCourse: vi.fn(),
  replaceCourse: vi.fn(),
  removeCourse: vi.fn(),
  certificateExists: vi.fn(),
  ...repo,
}));
vi.mock("@/contexts/bc_projects/services", () => ({
  listProjects: vi.fn(),
  hasCompanyData: vi.fn(),
}));

import {
  createAgentEntry,
  listAgents,
  removeAgentEntry,
  updateAgentEntry,
} from "@/contexts/bc_arsenal/services";

const agent = { kind: "agent" as const, id: "a1", name: "agy", role: "Review" };
const preset = { kind: "preset" as const, id: "p1", name: "P", command: "cmd" };
const script = { kind: "script" as const, id: "s1", name: "S", path: "scripts/x.sh" };

beforeEach(() => Object.values(repo).forEach((fn) => fn.mockReset()));

describe("listAgents", () => {
  it("grupuje wg rodzaju z zachowaniem kolejności pliku i przekazuje licznik pominiętych", () => {
    const agent2 = { ...agent, id: "a2", name: "cursor" };
    repo.readAgentEntries.mockReturnValue({ entries: [script, agent, preset, agent2], skipped: 4 });
    expect(listAgents()).toEqual({
      agents: [agent, agent2],
      presets: [preset],
      scripts: [script],
      skipped: 4,
    });
  });
});

describe("createAgentEntry", () => {
  it("zwraca wpis z repozytorium", async () => {
    repo.insertAgentEntry.mockResolvedValue(preset);
    const input = { kind: "preset" as const, name: "P", command: "cmd" };
    expect(await createAgentEntry(input)).toEqual(preset);
    expect(repo.insertAgentEntry).toHaveBeenCalledWith(input);
  });
});

describe("updateAgentEntry", () => {
  it("zapisuje i zwraca świeży wpis", async () => {
    repo.replaceAgentEntry.mockResolvedValue(undefined);
    repo.readAgentEntries.mockReturnValue({ entries: [agent], skipped: 0 });
    const input = { kind: "agent" as const, name: "agy", role: "Review" };
    expect(await updateAgentEntry("a1", input)).toEqual(agent);
    expect(repo.replaceAgentEntry).toHaveBeenCalledWith("a1", input);
  });

  it("wpis, który zniknął po zapisie, to 404", async () => {
    repo.replaceAgentEntry.mockResolvedValue(undefined);
    repo.readAgentEntries.mockReturnValue({ entries: [], skipped: 0 });
    await expect(
      updateAgentEntry("a1", { kind: "agent", name: "x", role: "r" })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("removeAgentEntry", () => {
  it("deleguje do repozytorium", async () => {
    repo.deleteAgentEntry.mockResolvedValue(undefined);
    await removeAgentEntry("a1");
    expect(repo.deleteAgentEntry).toHaveBeenCalledWith("a1");
  });
});
