import { randomUUID } from "node:crypto";
import { z } from "zod";
import { defineTool } from "@/lib/agent/tools";
import * as mindMapService from "@/services/mindMapService";
import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import { findNode, mapNode, moveNodeUnder, removeNode } from "@/src/lib/mindMapUtils";

const ROOT_ID = "root";

type OutlineNode = { id: string; label: string; note?: string; children: OutlineNode[] };

function outline(node: MindMapNode): OutlineNode {
  const note = (node.note ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 120);
  return {
    id: node.id,
    label: node.label,
    ...(note ? { note } : {}),
    children: node.children.map(outline),
  };
}

function countDescendants(node: MindMapNode): number {
  return node.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

function requireNode(root: MindMapNode, id: string): MindMapNode {
  const n = findNode(root, id);
  if (!n) throw new Error(`Node not found: ${id}`);
  return n;
}

function requireNotRoot(nodeId: string): void {
  if (nodeId === ROOT_ID) throw new Error("The root node cannot be moved or deleted.");
}

export const mindMapTools = [
  defineTool({
    name: "list_mind_maps",
    description: "List the user's mind maps (id and title).",
    schema: z.object({}),
    readOnly: true,
    run: async (userId) => {
      const maps = await mindMapService.getMindMaps(userId);
      return { ok: true, data: maps.map((m) => ({ id: m.id, title: m.title })) };
    },
  }),
  defineTool({
    name: "get_mind_map",
    description:
      "Get one mind map as a tree outline. Every node has an id, label, optional short note and children. The root id is 'root'.",
    schema: z.object({ mapId: z.string().min(1) }),
    readOnly: true,
    run: async (userId, { mapId }) => {
      const map = await mindMapService.getMindMap(userId, mapId);
      return { ok: true, data: { id: map.id, title: map.title, outline: outline(map.rootNode) } };
    },
  }),
  defineTool({
    name: "create_mind_map",
    description: "Create a new empty mind map with the given title.",
    schema: z.object({ title: z.string().min(1).max(120) }),
    run: async (userId, { title }) => {
      const map = await mindMapService.createMindMap(userId, title);
      return {
        ok: true,
        data: { id: map.id, title: map.title },
        changed: "mindmaps",
        summary: `Utworzono mapę „${map.title}”`,
      };
    },
  }),
  defineTool({
    name: "add_mind_map_node",
    description:
      "Add a child node under parentId (default 'root') in a mind map. note is optional plain text.",
    schema: z.object({
      mapId: z.string().min(1),
      parentId: z.string().min(1).optional(),
      label: z.string().min(1).max(200),
      note: z.string().max(5000).optional(),
    }),
    run: async (userId, args) => {
      const map = await mindMapService.getMindMap(userId, args.mapId);
      const parentId = args.parentId ?? ROOT_ID;
      requireNode(map.rootNode, parentId);
      const child: MindMapNode = {
        id: randomUUID().slice(0, 8),
        label: args.label,
        note: args.note ?? "",
        collapsed: false,
        children: [],
      };
      const rootNode = mapNode(map.rootNode, parentId, (p) => ({
        ...p,
        children: [...p.children, child],
      }));
      await mindMapService.saveMindMap(userId, args.mapId, { rootNode });
      return {
        ok: true,
        data: { id: child.id },
        changed: "mindmaps",
        summary: `Dodano węzeł „${args.label}” w mapie „${map.title}”`,
      };
    },
  }),
  defineTool({
    name: "update_mind_map_node",
    description: "Change the label and/or note of a node.",
    schema: z.object({
      mapId: z.string().min(1),
      nodeId: z.string().min(1),
      label: z.string().min(1).max(200).optional(),
      note: z.string().max(5000).optional(),
    }),
    run: async (userId, args) => {
      if (args.label === undefined && args.note === undefined) {
        return { ok: false, error: "Nothing to update" };
      }
      const map = await mindMapService.getMindMap(userId, args.mapId);
      requireNode(map.rootNode, args.nodeId);
      const rootNode = mapNode(map.rootNode, args.nodeId, (n) => ({
        ...n,
        label: args.label ?? n.label,
        note: args.note ?? n.note,
      }));
      await mindMapService.saveMindMap(userId, args.mapId, { rootNode });
      return {
        ok: true,
        data: { id: args.nodeId },
        changed: "mindmaps",
        summary: `Zaktualizowano węzeł w mapie „${map.title}”`,
      };
    },
  }),
  defineTool({
    name: "move_mind_map_node",
    description: "Move a node (with its children) under another node. The root cannot be moved.",
    schema: z.object({
      mapId: z.string().min(1),
      nodeId: z.string().min(1),
      newParentId: z.string().min(1),
    }),
    run: async (userId, args) => {
      requireNotRoot(args.nodeId);
      const map = await mindMapService.getMindMap(userId, args.mapId);
      requireNode(map.rootNode, args.nodeId);
      requireNode(map.rootNode, args.newParentId);
      const rootNode = moveNodeUnder(map.rootNode, args.nodeId, args.newParentId);
      if (rootNode === map.rootNode) {
        return { ok: false, error: "Cannot move a node under itself or its own descendant." };
      }
      await mindMapService.saveMindMap(userId, args.mapId, { rootNode });
      return {
        ok: true,
        data: { id: args.nodeId },
        changed: "mindmaps",
        summary: `Przeniesiono węzeł w mapie „${map.title}”`,
      };
    },
  }),
  defineTool({
    name: "delete_mind_map_node",
    description:
      "Delete a node together with all its children. The root cannot be deleted. Requires user confirmation.",
    schema: z.object({ mapId: z.string().min(1), nodeId: z.string().min(1) }),
    destructive: true,
    describe: async (userId, { mapId, nodeId }) => {
      requireNotRoot(nodeId);
      const map = await mindMapService.getMindMap(userId, mapId);
      const n = requireNode(map.rootNode, nodeId);
      return `Usunąć węzeł „${n.label}” (oraz ${countDescendants(n)} potomnych) z mapy „${map.title}”?`;
    },
    run: async (userId, { mapId, nodeId }) => {
      requireNotRoot(nodeId);
      const map = await mindMapService.getMindMap(userId, mapId);
      const n = requireNode(map.rootNode, nodeId);
      await mindMapService.saveMindMap(userId, mapId, {
        rootNode: removeNode(map.rootNode, nodeId),
      });
      return {
        ok: true,
        data: { id: nodeId },
        changed: "mindmaps",
        summary: `Usunięto węzeł „${n.label}” z mapy „${map.title}”`,
      };
    },
  }),
  defineTool({
    name: "delete_mind_map",
    description: "Delete an entire mind map. Requires user confirmation.",
    schema: z.object({ mapId: z.string().min(1) }),
    destructive: true,
    describe: async (userId, { mapId }) => {
      const map = await mindMapService.getMindMap(userId, mapId);
      return `Usunąć całą mapę „${map.title}”?`;
    },
    run: async (userId, { mapId }) => {
      const map = await mindMapService.getMindMap(userId, mapId);
      await mindMapService.deleteMindMap(userId, mapId);
      return {
        ok: true,
        data: { id: mapId },
        changed: "mindmaps",
        summary: `Usunięto mapę „${map.title}”`,
      };
    },
  }),
];
