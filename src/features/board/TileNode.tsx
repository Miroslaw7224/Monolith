import React from "react";
import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import type { BoardTileDto as BoardTile } from "@/contexts/bc_board/schemas";

export type TileNodeData = {
  tile: BoardTile;
  onDelete: (id: string) => void;
  onResizeEnd?: (params: { x: number; y: number; width: number; height: number }) => void;
};
export type TileFlowNode = Node<TileNodeData, "tile">;

export function TileNode({ id, data, selected }: NodeProps<TileFlowNode>) {
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={72}
        onResizeEnd={(_event, params) => data.onResizeEnd?.(params)}
      />
      <Handle type="target" position={Position.Left} />
      <div className={`plo-tile ${selected ? "plo-tile--selected" : ""}`}>
        <div className="plo-tile__head">
          <span className="plo-tile__title">{data.tile.title}</span>
          {selected ? (
            <button
              type="button"
              aria-label="delete-tile"
              className="plo-node-del"
              onClick={() => data.onDelete(id)}
            >
              ×
            </button>
          ) : null}
        </div>
        {data.tile.note ? <p className="plo-tile__note">{data.tile.note}</p> : null}
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  );
}
