import React from "react";
import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import type { BoardTile } from "@/src/features/board/boardTypes";

export type TileNodeData = { tile: BoardTile; onDelete: (id: string) => void };
export type TileFlowNode = Node<TileNodeData, "tile">;

export function TileNode({ id, data, selected }: NodeProps<TileFlowNode>) {
  return (
    <>
      <NodeResizer isVisible={selected} minWidth={160} minHeight={72} />
      <Handle type="target" position={Position.Left} />
      <div className="h-full w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm font-semibold text-[var(--text)]">
        {data.tile.title}
        {selected ? (
          <button
            type="button"
            aria-label="delete-tile"
            className="ml-2"
            onClick={() => data.onDelete(id)}
          >
            ×
          </button>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  );
}
