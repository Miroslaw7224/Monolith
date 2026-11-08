import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";

export type BoardEdgeData = { onRemove: (id: string) => void };
export type BoardFlowEdge = Edge<BoardEdgeData, "board">;

export function BoardEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps<BoardFlowEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  return (
    <>
      <BaseEdge id={id} path={path} />
      {selected ? (
        <EdgeLabelRenderer>
          <button
            type="button"
            aria-label="delete-edge"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            className="nodrag nopan"
            onClick={() => data?.onRemove(id)}
          >
            ×
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
