// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Project, ProjectWithContent } from "@/contexts/bc_projects/models";
import { toDetailDto, toSummaryDto } from "@/contexts/bc_projects/schemas";

const base: Project = {
  id: "a",
  name: "Alpha",
  status: "active",
  priority: "high",
  folder: "Projects/a/",
  localPath: "/tmp/a",
  github: "https://g",
  owner: "personal",
  lastWorked: "2026-11-05",
  stateConfidence: "verified",
  whereIStopped: "tu",
  freshness: "fresh",
};

describe("bc_projects schemas", () => {
  it("toSummaryDto bez folder i whereIStopped", () => {
    const dto = toSummaryDto(base);
    expect("folder" in dto).toBe(false);
    expect(dto).toMatchObject({
      id: "a",
      localPath: "/tmp/a",
      freshness: "fresh",
      lastWorked: "2026-11-05",
    });
    expect("whereIStopped" in dto).toBe(false);
  });

  it("toDetailDto z tasks, bugs, whereIStopped bez folder", () => {
    const full: ProjectWithContent = {
      ...base,
      tasks: [{ heading: "Next", items: [{ text: "A", done: false }] }],
      bugs: [{ id: "B-1", title: "x", section: "Aktywne" }],
    };
    const dto = toDetailDto(full);
    expect("folder" in dto).toBe(false);
    expect(dto.whereIStopped).toBe("tu");
    expect(dto.tasks).toEqual(full.tasks);
    expect(dto.bugs).toEqual(full.bugs);
  });
});
