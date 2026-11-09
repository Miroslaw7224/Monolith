import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import { findNode } from "@/src/lib/mindMapUtils";

export type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

export type ArrowResult =
  | { type: "select"; id: string }
  | { type: "collapse"; id: string }
  | { type: "expand"; id: string }
  | { type: "none" };

type VisibleNode = { id: string; parentId: string | null };

export function listVisible(root: MindMapNode): VisibleNode[] {
  const out: VisibleNode[] = [];
  const walk = (node: MindMapNode, parentId: string | null) => {
    out.push({ id: node.id, parentId });
    if (node.collapsed) return;
    for (const child of node.children) walk(child, node.id);
  };
  walk(root, null);
  return out;
}

export function arrowAction(
  root: MindMapNode,
  selectedId: string | null,
  key: ArrowKey
): ArrowResult {
  const visible = listVisible(root);
  if (visible.length === 0) return { type: "none" };
  const currentId =
    selectedId && visible.some((item) => item.id === selectedId) ? selectedId : visible[0].id;
  const index = visible.findIndex((item) => item.id === currentId);
  const current = visible[index];

  if (key === "ArrowDown" || key === "ArrowUp") {
    const nextIndex =
      key === "ArrowDown" ? Math.min(visible.length - 1, index + 1) : Math.max(0, index - 1);
    const next = visible[nextIndex];
    return next.id === currentId ? { type: "none" } : { type: "select", id: next.id };
  }

  const node = findNode(root, currentId);
  if (!node) return { type: "none" };

  if (key === "ArrowRight") {
    if (node.children.length === 0) return { type: "none" };
    if (node.collapsed) return { type: "expand", id: node.id };
    return { type: "select", id: node.children[0].id };
  }

  if (node.children.length > 0 && !node.collapsed) return { type: "collapse", id: node.id };
  if (current.parentId) return { type: "select", id: current.parentId };
  return { type: "none" };
}

export function findLabelMatches(root: MindMapNode, query: string): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const ids: string[] = [];
  const walk = (node: MindMapNode) => {
    if (node.label.toLowerCase().includes(needle)) ids.push(node.id);
    node.children.forEach(walk);
  };
  walk(root);
  return ids;
}

export function revealMatches(root: MindMapNode, matchIds: ReadonlySet<string>): MindMapNode {
  const walk = (node: MindMapNode): { node: MindMapNode; hasMatchBelow: boolean } => {
    const childResults = node.children.map(walk);
    const hasMatchBelow = childResults.some((result) => result.hasMatchBelow);
    const children = childResults.map((result) => result.node);
    const childrenChanged = children.some((child, index) => child !== node.children[index]);
    const shouldOpen = hasMatchBelow && node.collapsed;
    if (!childrenChanged && !shouldOpen) {
      return { node, hasMatchBelow: hasMatchBelow || matchIds.has(node.id) };
    }
    return {
      hasMatchBelow: true,
      node: { ...node, collapsed: shouldOpen ? false : node.collapsed, children },
    };
  };
  return walk(root).node;
}
