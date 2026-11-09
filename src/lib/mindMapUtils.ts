import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";

export function findNode(root: MindMapNode, id: string): MindMapNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function mapNode(
  root: MindMapNode,
  id: string,
  fn: (node: MindMapNode) => MindMapNode
): MindMapNode {
  if (root.id === id) return fn(root);
  return { ...root, children: root.children.map((c) => mapNode(c, id, fn)) };
}

export function mapAllNodes(
  root: MindMapNode,
  fn: (node: MindMapNode) => MindMapNode
): MindMapNode {
  return fn({ ...root, children: root.children.map((c) => mapAllNodes(c, fn)) });
}

export function removeNode(root: MindMapNode, id: string): MindMapNode {
  return {
    ...root,
    children: root.children.filter((c) => c.id !== id).map((c) => removeNode(c, id)),
  };
}

/**
 * Delete a node, but keep its children by promoting them one level up.
 * Mirrors `delKeep` behavior from the prototype.
 */
export function deleteNodeKeepChildren(root: MindMapNode, id: string): MindMapNode {
  const nextChildren: MindMapNode[] = [];

  for (const child of root.children) {
    if (child.id === id) {
      nextChildren.push(...child.children);
      continue;
    }
    nextChildren.push(deleteNodeKeepChildren(child, id));
  }

  return { ...root, children: nextChildren };
}

/**
 * Insert a new parent node directly above `childId` (between current parent and the child).
 * Mirrors `insAbove` behavior from the prototype.
 */
export function insertNodeAbove(
  root: MindMapNode,
  childId: string,
  newParent: Omit<MindMapNode, "children"> & { children?: MindMapNode[] }
): MindMapNode {
  return {
    ...root,
    children: root.children.map((c) =>
      c.id === childId ? { ...newParent, children: [c] } : insertNodeAbove(c, childId, newParent)
    ),
  };
}

/**
 * Move `nodeId` under `parentId`.
 * Prevents cycles by blocking moves where `parentId` is inside `nodeId` subtree.
 * Mirrors `moveUnder` behavior from the prototype.
 */
export function insertSiblingAfter(
  root: MindMapNode,
  siblingId: string,
  node: MindMapNode
): MindMapNode {
  if (root.id === siblingId) return root;
  const index = root.children.findIndex((child) => child.id === siblingId);
  if (index >= 0) {
    const children = root.children.slice();
    children.splice(index + 1, 0, node);
    return { ...root, collapsed: false, children };
  }
  let changed = false;
  const children = root.children.map((child) => {
    const next = insertSiblingAfter(child, siblingId, node);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...root, children } : root;
}

export function moveSibling(root: MindMapNode, nodeId: string, delta: -1 | 1): MindMapNode {
  const index = root.children.findIndex((child) => child.id === nodeId);
  if (index >= 0) {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= root.children.length) return root;
    const children = root.children.slice();
    const [item] = children.splice(index, 1);
    children.splice(nextIndex, 0, item);
    return { ...root, children };
  }
  let changed = false;
  const children = root.children.map((child) => {
    const next = moveSibling(child, nodeId, delta);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...root, children } : root;
}

export function moveNodeUnder(root: MindMapNode, nodeId: string, parentId: string): MindMapNode {
  const node = findNode(root, nodeId);
  if (!node) return root;
  if (findNode(node, parentId)) return root;

  const withoutNode = removeNode(root, nodeId);
  return mapNode(withoutNode, parentId, (p) => ({ ...p, children: [...p.children, node] }));
}

export function leafCount(node: MindMapNode): number {
  if (node.children.length === 0 || node.collapsed) return 1;
  return node.children.reduce((sum, c) => sum + leafCount(c), 0);
}
