import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";

export const ROW_H = 42;
export const GAP_H = 8;
export const CONN = 24;

const CHROME_PX = 96;
const CHAR_PX = 7;
const LINE_PX = 18;
const MAX_LINES = 3;
const PAD_Y = 12;

export const BRANCH_COLORS = [
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#f43f5e",
  "#14b8a6",
] as const;

export function branchColor(index: number): string {
  return BRANCH_COLORS[index % BRANCH_COLORS.length];
}

export function labelLineCount(label: string, colW: number): number {
  const textWidth = Math.max(40, colW - CHROME_PX);
  const perLine = Math.max(4, Math.floor(textWidth / CHAR_PX));
  return Math.min(MAX_LINES, Math.max(1, Math.ceil(label.length / perLine)));
}

export function nodeBoxHeight(label: string, colW: number): number {
  return Math.max(ROW_H, PAD_Y + labelLineCount(label, colW) * LINE_PX);
}

export function subtreeHeight(
  node: MindMapNode,
  depth: number,
  getColW: (depth: number) => number
): number {
  const own = nodeBoxHeight(node.label, getColW(depth));
  if (node.collapsed || node.children.length === 0) return own;
  let childrenSum = 0;
  node.children.forEach((child, index) => {
    if (index > 0) childrenSum += GAP_H;
    childrenSum += subtreeHeight(child, depth + 1, getColW);
  });
  return Math.max(own, childrenSum);
}
