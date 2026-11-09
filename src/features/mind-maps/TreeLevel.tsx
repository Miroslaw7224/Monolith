"use client";

import React from "react";
import type { MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import {
  CONN,
  GAP_H,
  branchColor,
  nodeBoxHeight,
  subtreeHeight,
} from "@/src/features/mind-maps/mindMapLayout";
import type { translations } from "@/src/translations";
import { NodePill } from "@/src/features/mind-maps/NodePill";

export function TreeLevel(props: {
  mode: "edit" | "readOnly";
  node: MindMapNode;
  isRoot: boolean;
  depth: number;
  t: (typeof translations)["en"];
  getColW: (depth: number) => number;
  startResize: (e: React.MouseEvent, depth: number) => void;
  selId: string | null;
  editId: string | null;
  ctxId: string | null;
  dragId: string | null;
  dropId: string | null;
  onSelect: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  onStartEdit: (id: string) => void;
  onCommitLabel: (id: string, next: string) => void;
  onToggleCtx: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onAddChildAIImport: (parentId: string) => void;
  onInsertAbove: (childId: string) => void;
  onRequestDelete: (id: string) => void;
  onOpenAI: (parentId: string) => void;
  onExportToOtherMap: (nodeId: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: (targetId: string) => void;
  onDragEnd: () => void;
  onAddSibling: (id: string) => void;
  onReorderSibling: (id: string, delta: -1 | 1) => void;
  highlightedIds: ReadonlySet<string>;
  activeMatchId: string | null;
  branchColor?: string;
}) {
  const { node, depth, getColW, branchColor: color } = props;
  const hasKids = node.children.length > 0 && !node.collapsed;
  const pillH = nodeBoxHeight(node.label, getColW(depth));
  const line = color ?? "var(--border)";

  if (!hasKids) {
    return (
      <div style={{ height: pillH }} className="flex items-center">
        <NodePill {...props} />
      </div>
    );
  }

  const childHeights = node.children.map((child) => subtreeHeight(child, depth + 1, getColW));
  const childrenSum = childHeights.reduce(
    (sum, height, index) => sum + height + (index > 0 ? GAP_H : 0),
    0
  );
  const totalH = Math.max(pillH, childrenSum);
  const offset = (totalH - childrenSum) / 2;
  const vTop = offset + childHeights[0] / 2;
  const vBot = offset + childrenSum - childHeights[childHeights.length - 1] / 2;
  const vH = Math.max(0, vBot - vTop);
  const half = CONN / 2;

  return (
    <div style={{ height: totalH }} className="flex items-center">
      <NodePill {...props} />

      <div style={{ width: CONN, height: totalH }} className="relative flex-shrink-0">
        <div
          style={{ width: half, height: 1, left: 0, top: "50%", background: line }}
          className="absolute -translate-y-1/2"
        />
        <div
          style={{ width: 1, height: vH, left: half, top: vTop, background: line }}
          className="absolute"
        />
      </div>

      <div style={{ height: totalH, paddingTop: offset }} className="flex flex-col">
        {node.children.map((child, index) => {
          const childColor = depth === 0 ? branchColor(index) : color;
          return (
            <div
              key={child.id}
              style={{ height: childHeights[index], marginTop: index > 0 ? GAP_H : 0 }}
              className="flex items-center"
            >
              <div
                style={{ width: half, height: 1, background: childColor ?? "var(--border)" }}
                className="flex-shrink-0"
              />
              <TreeLevel
                {...props}
                node={child}
                isRoot={false}
                depth={depth + 1}
                branchColor={childColor}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
