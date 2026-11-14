import { describe, expect, it } from "vitest";
import { EDGE_CLASSES, buildEdgeMaps, edgeClass, groupEdges } from "@/src/features/map/edgeColors";

const clusters = [
  { id: "knowledge:a", label: "a", group: "knowledge" as const, size: 3 },
  { id: "knowledge:b", label: "b", group: "knowledge" as const, size: 1 },
  { id: "p1", label: "P1", group: "projects" as const, size: 2, projectId: "p1" },
  { id: "p2", label: "P2", group: "projects" as const, size: 1, projectId: "p2" },
  { id: "ai-2030", label: "AI-2030", group: "ai2030" as const, size: 2 },
];
const note = (id: string, cluster: string) => ({ id, label: id, cluster, links: 0 });
const nodes = [
  note("n1", "knowledge:a"),
  note("n2", "knowledge:a"),
  note("n3", "knowledge:b"),
  note("n4", "p1"),
  note("n5", "p1"),
  note("n6", "p2"),
  note("n7", "ai-2030"),
  note("n8", "ai-2030"),
];
const link = (from: string, to: string) => ({ from, to, weight: 1, type: "link" as const });
const maps = buildEdgeMaps(nodes, clusters);

describe("EDGE_CLASSES", () => {
  it("ma co najmniej 8 klas o różnych kolorach", () => {
    expect(EDGE_CLASSES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(EDGE_CLASSES.map((c) => c.color)).size).toBe(EDGE_CLASSES.length);
    expect(new Set(EDGE_CLASSES.map((c) => c.id)).size).toBe(EDGE_CLASSES.length);
  });
});

describe("edgeClass", () => {
  it.each([
    ["Wiedza, ta sama kategoria", link("n1", "n2"), "kk-same"],
    ["Wiedza, różne kategorie", link("n1", "n3"), "kk-cross"],
    ["Wiedza ↔ notatka projektu", link("n1", "n4"), "kp"],
    ["pole projects:", { from: "n1", to: "p1", weight: 1, type: "project" as const }, "k-field"],
    ["w obrębie projektu", link("n4", "n5"), "pp-same"],
    ["między projektami", link("n4", "n6"), "pp-cross"],
    ["Wiedza ↔ AI-2030", link("n1", "n7"), "ka"],
    ["Projekt ↔ AI-2030", link("n4", "n7"), "pa"],
    ["w obrębie AI-2030", link("n7", "n8"), "aa"],
  ])("%s", (_name, edge, expected) => {
    expect(edgeClass(edge, maps)).toBe(expected);
  });

  it("kolejność końców nie ma znaczenia; nieznana notatka daje null", () => {
    expect(edgeClass(link("n4", "n1"), maps)).toBe("kp");
    expect(edgeClass(link("n1", "nie-ma"), maps)).toBeNull();
  });
});

describe("groupEdges", () => {
  it("grupuje krawędzie po klasie i pomija nieklasyfikowalne", () => {
    const grouped = groupEdges([link("n1", "n2"), link("n2", "n1"), link("n1", "x")], maps);
    expect(grouped.get("kk-same")).toHaveLength(2);
    expect([...grouped.keys()]).toEqual(["kk-same"]);
  });
});
