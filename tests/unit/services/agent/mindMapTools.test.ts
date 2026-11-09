import { describe, it, expect, vi } from "vitest";

const mockGetMindMaps = vi.hoisted(() => vi.fn());
const mockGetMindMap = vi.hoisted(() => vi.fn());
const mockCreateMindMap = vi.hoisted(() => vi.fn());
const mockSaveMindMap = vi.hoisted(() => vi.fn());
const mockDeleteMindMap = vi.hoisted(() => vi.fn());

vi.mock("@/services/mindMapService", () => ({
  getMindMaps: mockGetMindMaps,
  getMindMap: mockGetMindMap,
  createMindMap: mockCreateMindMap,
  saveMindMap: mockSaveMindMap,
  deleteMindMap: mockDeleteMindMap,
}));

import { executeTool } from "@/lib/agent/tools";
import { mindMapTools } from "@/services/agent/mindMapTools";

const node = (id: string, label: string, children: unknown[] = []) => ({
  id,
  label,
  note: "",
  collapsed: false,
  children,
});

const sampleMap = () => ({
  id: "m1",
  userId: "u1",
  title: "Projekt",
  colWidths: {},
  rootNode: node("root", "Projekt", [node("a", "Backend", [node("a1", "API")]), node("b", "Frontend")]),
});

describe("mindMapTools", () => {
  it("get_mind_map returns a compact outline with ids", async () => {
    mockGetMindMap.mockResolvedValue(sampleMap());
    const res = await executeTool(mindMapTools, "u1", "get_mind_map", { mapId: "m1" });
    expect(res.ok).toBe(true);
    const outline = (res as { data: { outline: { id: string; children: { id: string }[] } } }).data.outline;
    expect(outline.id).toBe("root");
    expect(outline.children.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("add_mind_map_node appends a child under the parent and saves the root node", async () => {
    mockGetMindMap.mockResolvedValue(sampleMap());
    const res = await executeTool(mindMapTools, "u1", "add_mind_map_node", {
      mapId: "m1",
      parentId: "b",
      label: "Komponenty",
      note: "React",
    });
    expect(res.ok && res.changed).toBe("mindmaps");
    const saved = mockSaveMindMap.mock.calls[0][2].rootNode;
    const b = saved.children.find((c: { id: string }) => c.id === "b");
    expect(b.children).toHaveLength(1);
    expect(b.children[0]).toMatchObject({ label: "Komponenty", note: "React", children: [] });
  });

  it("add_mind_map_node defaults the parent to root", async () => {
    mockGetMindMap.mockResolvedValue(sampleMap());
    await executeTool(mindMapTools, "u1", "add_mind_map_node", { mapId: "m1", label: "Nowy" });
    const saved = mockSaveMindMap.mock.calls[0][2].rootNode;
    expect(saved.children).toHaveLength(3);
  });

  it("add_mind_map_node errors when the parent does not exist", async () => {
    mockGetMindMap.mockResolvedValue(sampleMap());
    const res = await executeTool(mindMapTools, "u1", "add_mind_map_node", {
      mapId: "m1",
      parentId: "nope",
      label: "x",
    });
    expect(res.ok).toBe(false);
    expect(mockSaveMindMap).not.toHaveBeenCalled();
  });

  it("update_mind_map_node changes label and note", async () => {
    mockGetMindMap.mockResolvedValue(sampleMap());
    await executeTool(mindMapTools, "u1", "update_mind_map_node", {
      mapId: "m1",
      nodeId: "a1",
      label: "REST API",
    });
    const saved = mockSaveMindMap.mock.calls[0][2].rootNode;
    expect(saved.children[0].children[0].label).toBe("REST API");
  });

  it("move_mind_map_node refuses to move the root and refuses cycles", async () => {
    mockGetMindMap.mockResolvedValue(sampleMap());
    const rootMove = await executeTool(mindMapTools, "u1", "move_mind_map_node", {
      mapId: "m1",
      nodeId: "root",
      newParentId: "a",
    });
    expect(rootMove.ok).toBe(false);
    const cycle = await executeTool(mindMapTools, "u1", "move_mind_map_node", {
      mapId: "m1",
      nodeId: "a",
      newParentId: "a1",
    });
    expect(cycle.ok).toBe(false);
    expect(mockSaveMindMap).not.toHaveBeenCalled();
  });

  it("move_mind_map_node moves a node under a new parent", async () => {
    mockGetMindMap.mockResolvedValue(sampleMap());
    await executeTool(mindMapTools, "u1", "move_mind_map_node", {
      mapId: "m1",
      nodeId: "a1",
      newParentId: "b",
    });
    const saved = mockSaveMindMap.mock.calls[0][2].rootNode;
    expect(saved.children[0].children).toHaveLength(0);
    expect(saved.children[1].children[0].id).toBe("a1");
  });

  it("delete_mind_map_node is destructive, describes descendants, and refuses the root", async () => {
    mockGetMindMap.mockResolvedValue(sampleMap());
    const tool = mindMapTools.find((t) => t.name === "delete_mind_map_node")!;
    expect(tool.destructive).toBe(true);
    const text = await tool.describe!("u1", { mapId: "m1", nodeId: "a" });
    expect(text).toContain("Backend");
    expect(text).toContain("1");
    await expect(tool.describe!("u1", { mapId: "m1", nodeId: "root" })).rejects.toThrow();
  });

  it("delete_mind_map run removes the node subtree", async () => {
    mockGetMindMap.mockResolvedValue(sampleMap());
    await executeTool(mindMapTools, "u1", "delete_mind_map_node", { mapId: "m1", nodeId: "a" });
    const saved = mockSaveMindMap.mock.calls[0][2].rootNode;
    expect(saved.children.map((c: { id: string }) => c.id)).toEqual(["b"]);
  });

  it("delete_mind_map is destructive", () => {
    expect(mindMapTools.find((t) => t.name === "delete_mind_map")!.destructive).toBe(true);
  });
});
