import React from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import type { BoardFrame } from "@/src/features/board/boardTypes";

export type FrameNodeData = {
  frame: BoardFrame;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
};
export type FrameFlowNode = Node<FrameNodeData, "frame">;

export function FrameNode({ id, data, selected }: NodeProps<FrameFlowNode>) {
  return (
    <>
      <NodeResizer isVisible={selected} minWidth={200} minHeight={120} />
      <div className="h-full w-full rounded-xl border border-dashed border-[var(--border)]">
        <button
          type="button"
          className="px-2 py-1 text-xs font-bold"
          onDoubleClick={() => data.onRename(id)}
        >
          {data.frame.title}
        </button>
        {selected ? (
          <button type="button" aria-label="delete-frame" onClick={() => data.onDelete(id)}>
            ×
          </button>
        ) : null}
      </div>
    </>
  );
}
