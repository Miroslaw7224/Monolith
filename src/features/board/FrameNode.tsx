import React from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import type { BoardFrameDto as BoardFrame } from "@/contexts/bc_board/schemas";
import { useT } from "@/src/i18n/useT";

export type FrameNodeData = {
  frame: BoardFrame;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onResizeEnd?: (params: { x: number; y: number; width: number; height: number }) => void;
};
export type FrameFlowNode = Node<FrameNodeData, "frame">;

export function FrameNode({ id, data, selected }: NodeProps<FrameFlowNode>) {
  const t = useT();
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={120}
        onResizeEnd={(_event, params) => data.onResizeEnd?.(params)}
      />
      <div className={`plo-frame ${selected ? "plo-frame--selected" : ""}`}>
        <div className="plo-frame__head">
          <button
            type="button"
            className="plo-frame__title"
            onDoubleClick={() => data.onRename(id)}
          >
            {data.frame.title}
          </button>
          {selected ? (
            <button
              type="button"
              aria-label={t("planning:boardDeleteFrameAria")}
              className="plo-node-del"
              onClick={() => data.onDelete(id)}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
