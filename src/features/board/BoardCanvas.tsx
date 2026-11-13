import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
  type OnBeforeDelete,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { BoardDto as Board, BoardFrameDto as BoardFrame } from "@/contexts/bc_board/schemas";
import type { BoardBox } from "@/src/features/board/boardTypes";
import { boxChanged, withMembership } from "@/src/features/board/boardLayout";
import {
  addFrame,
  addTile,
  connectTiles,
  placeFrame,
  placeTile,
  reconnectEdge,
  removeEdge,
  renameFrame,
} from "@/src/features/board/boardActions";
import { applyDelete, deleteCopy, deletePlan } from "@/src/features/board/boardDelete";
import {
  readViewport,
  storeViewport,
  type BoardViewport,
} from "@/src/features/board/boardViewport";
import { BoardEdge, type BoardFlowEdge } from "@/src/features/board/BoardEdge";
import { FrameNode, type FrameFlowNode } from "@/src/features/board/FrameNode";
import { TileNode, type TileFlowNode } from "@/src/features/board/TileNode";
import { ConfirmDeleteDialog } from "@/src/features/board/ConfirmDeleteDialog";
import { FrameNameDialog } from "@/src/features/board/FrameNameDialog";

export interface BoardCanvasLabels {
  addTile: string;
  addFrame: string;
  newTile: string;
  frameName: string;
  save: string;
  cancel: string;
  delete: string;
}

const nodeTypes = { tile: TileNode, frame: FrameNode };
const edgeTypes = { board: BoardEdge };

function buildGraph(
  board: Board,
  actions: {
    onDelete: (id: string) => void;
    onRename: (id: string) => void;
    onRemoveEdge: (id: string) => void;
    onResizeFrame: (id: string, params: ResizeParams) => void;
    onResizeTile: (id: string, frameId: string | null, params: ResizeParams) => void;
  }
) {
  const frames = new Map(board.frames.map((frame) => [frame.id, frame]));
  const frameNodes: FrameFlowNode[] = board.frames.map((frame) => ({
    id: frame.id,
    type: "frame",
    position: { x: frame.x, y: frame.y },
    zIndex: -1,
    style: { width: frame.w, height: frame.h },
    data: {
      frame,
      onRename: actions.onRename,
      onDelete: actions.onDelete,
      onResizeEnd: (params: ResizeParams) => actions.onResizeFrame(frame.id, params),
    },
  }));
  const tileNodes: TileFlowNode[] = board.tiles.map((tile) => {
    const frame = tile.frame ? frames.get(tile.frame) : undefined;
    return {
      id: tile.id,
      type: "tile",
      parentId: frame ? frame.id : undefined,
      position: frame ? { x: tile.x - frame.x, y: tile.y - frame.y } : { x: tile.x, y: tile.y },
      style: { width: tile.w, height: tile.h },
      data: {
        tile,
        onDelete: actions.onDelete,
        onResizeEnd: (params: ResizeParams) => actions.onResizeTile(tile.id, tile.frame, params),
      },
    };
  });
  const edges: BoardFlowEdge[] = board.edges.map((edge) => ({
    id: edge.id,
    type: "board",
    source: edge.source,
    target: edge.target,
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { onRemove: actions.onRemoveEdge },
  }));
  return { nodes: [...frameNodes, ...tileNodes], edges };
}

function absoluteOrigin(node: Node, frames: BoardFrame[]) {
  const frame = frames.find((item) => item.id === node.parentId);
  return frame ? { x: node.position.x + frame.x, y: node.position.y + frame.y } : node.position;
}

function deleteIdsFromNodes(deleted: Node[]): string[] {
  const frameIds = new Set(deleted.filter((node) => node.type === "frame").map((node) => node.id));
  return deleted
    .filter((node) => {
      if (node.type === "frame") return true;
      if (node.type !== "tile") return false;
      if (node.parentId && frameIds.has(node.parentId) && !node.selected) return false;
      return true;
    })
    .map((node) => node.id);
}

type ResizeParams = { x: number; y: number; width: number; height: number };

export function resizeFrameBoard(board: Board, id: string, box: BoardBox): Board | null {
  const frame = board.frames.find((item) => item.id === id);
  if (!frame || !boxChanged(frame, box)) return null;
  const frames = board.frames.map((item) => (item.id === id ? { ...item, ...box } : item));
  return { ...board, frames, tiles: withMembership(board.tiles, frames) };
}

function boardsEqual(a: Board, b: Board): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function persistDraggedNodes(board: Board, dragged: Node[]): Board | null {
  let next = board;
  let changed = false;
  for (const node of dragged.filter((item) => item.type === "frame")) {
    const width = node.measured?.width ?? Number(node.style?.width ?? 0);
    const height = node.measured?.height ?? Number(node.style?.height ?? 0);
    const placed = placeFrame(next, node.id, {
      x: node.position.x,
      y: node.position.y,
      w: width,
      h: height,
    });
    if (placed) {
      next = placed;
      changed = true;
    }
  }
  for (const node of dragged.filter((item) => item.type === "tile")) {
    const width = node.measured?.width ?? Number(node.style?.width ?? 0);
    const height = node.measured?.height ?? Number(node.style?.height ?? 0);
    const origin = absoluteOrigin(node, next.frames);
    const placed = placeTile(next, node.id, { ...origin, w: width, h: height });
    if (placed) {
      next = placed;
      changed = true;
    }
  }
  return changed ? next : null;
}

function CanvasInner({
  board,
  lang,
  labels,
  dialogOpen,
  onChange,
  onDialogOpenChange,
  onTileAdded,
  onOpenTile,
}: {
  board: Board;
  lang: "pl" | "en";
  labels: BoardCanvasLabels;
  dialogOpen: boolean;
  onChange: (board: Board) => void;
  onDialogOpenChange: (open: boolean) => void;
  onTileAdded: (tileId: string) => void;
  onOpenTile: (tileId: string) => void;
}) {
  const flow = useReactFlow();
  const paneRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef(board);
  const deleteEmitScheduledRef = useRef(false);
  const [naming, setNaming] = useState<{ id: string | null; title: string } | null>(null);
  const [pending, setPending] = useState<{
    copy: { title: string; lines: string[] };
    resolve: (ok: boolean) => void;
  } | null>(null);
  const stored = readViewport();
  const actions = {
    onDelete: (id: string) => {
      void confirmDelete([id]).then((ok) => {
        if (ok) onChange(applyDelete(board, [id]));
      });
    },
    onRename: (id: string) => {
      const frame = board.frames.find((item) => item.id === id);
      if (frame) setNaming({ id, title: frame.title });
    },
    onRemoveEdge: (id: string) => onChange(removeEdge(board, id)),
    onResizeFrame: (id: string, params: ResizeParams) => {
      const next = resizeFrameBoard(board, id, {
        x: params.x,
        y: params.y,
        w: params.width,
        h: params.height,
      });
      if (next) onChange(next);
    },
    onResizeTile: (id: string, frameId: string | null, params: ResizeParams) => {
      const frame = frameId ? board.frames.find((item) => item.id === frameId) : undefined;
      const origin = frame
        ? { x: params.x + frame.x, y: params.y + frame.y }
        : { x: params.x, y: params.y };
      const next = placeTile(board, id, { ...origin, w: params.width, h: params.height });
      if (next) onChange(next);
    },
  };
  const initial = buildGraph(board, actions);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const applyDeleteMutation = useCallback(
    (mutate: (current: Board) => Board) => {
      const next = mutate(boardRef.current);
      if (boardsEqual(boardRef.current, next)) return;
      boardRef.current = next;
      if (deleteEmitScheduledRef.current) return;
      deleteEmitScheduledRef.current = true;
      queueMicrotask(() => {
        deleteEmitScheduledRef.current = false;
        onChange(boardRef.current);
      });
    },
    [onChange]
  );

  useEffect(() => {
    const next = buildGraph(board, actions);
    setNodes((current) => {
      const selected = new Set(current.filter((node) => node.selected).map((node) => node.id));
      return next.nodes.map((node) => ({ ...node, selected: selected.has(node.id) }));
    });
    setEdges(next.edges);
  }, [board, setEdges, setNodes]);

  useEffect(() => {
    onDialogOpenChange(Boolean(naming || pending));
  }, [naming, pending, onDialogOpenChange]);

  function center() {
    const rect = paneRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 100, y: 80 };
    return flow.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }

  function confirmDelete(ids: string[]) {
    const copy = deleteCopy(deletePlan(ids, board), lang);
    return new Promise<boolean>((resolve) => setPending({ copy, resolve }));
  }

  const onBeforeDelete: OnBeforeDelete = useCallback(
    async ({ nodes: deleted }) => {
      const ids = deleteIdsFromNodes(deleted);
      if (ids.length === 0) return true;
      return confirmDelete(ids);
    },
    [board, lang]
  );

  return (
    <div className="plo-canvas-container">
      <div className="plo-toolbar" role="toolbar" aria-label="Narzędzia tablicy">
        <button
          type="button"
          className="btn btn--primary plo-btn plo-btn--primary"
          onClick={() => {
            const added = addTile(board, center(), labels.newTile);
            onChange(added.board);
            onTileAdded(added.tileId);
          }}
        >
          {labels.addTile}
        </button>
        <button
          type="button"
          className="btn plo-btn"
          onClick={() => setNaming({ id: null, title: "" })}
        >
          {labels.addFrame}
        </button>
      </div>
      <div ref={paneRef} className="plo-canvas-wrap">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          deleteKeyCode={dialogOpen || naming || pending ? null : "Backspace"}
          minZoom={0.2}
          zoomOnDoubleClick={false}
          fitView={!stored}
          defaultViewport={stored ?? { x: 0, y: 0, zoom: 0.75 }}
          onMoveEnd={(_event, viewport: BoardViewport) => storeViewport(viewport)}
          onBeforeDelete={onBeforeDelete}
          onNodesDelete={(deleted) => {
            const ids = deleteIdsFromNodes(deleted);
            if (ids.length === 0) return;
            applyDeleteMutation((current) => applyDelete(current, ids));
          }}
          onEdgesDelete={(deleted) => {
            if (deleted.length === 0) return;
            applyDeleteMutation((current) =>
              deleted.reduce((currentBoard, edge) => removeEdge(currentBoard, edge.id), current)
            );
          }}
          onConnect={(connection) => {
            if (!connection.source || !connection.target) return;
            const next = connectTiles(board, connection.source, connection.target);
            if (next) onChange(next);
          }}
          onReconnect={(edge, connection) => {
            if (!connection.source || !connection.target) return;
            const next = reconnectEdge(board, edge.id, connection.source, connection.target);
            if (next) onChange(next);
          }}
          onNodeDragStop={(_event, _node, dragged) => {
            const next = persistDraggedNodes(board, dragged);
            if (next) onChange(next);
          }}
          onNodeDoubleClick={(_event, node) => {
            if (node.type === "tile") onOpenTile(node.id);
          }}
          edgesReconnectable
        >
          <MiniMap />
          <Controls showInteractive={false} />
          <Background gap={20} />
        </ReactFlow>
      </div>
      {naming ? (
        <FrameNameDialog
          title={labels.frameName}
          initialTitle={naming.title}
          submitLabel={labels.save}
          cancelLabel={labels.cancel}
          onCancel={() => setNaming(null)}
          onSubmit={(title) => {
            const next = naming.id
              ? renameFrame(board, naming.id, title)
              : addFrame(board, center(), title);
            setNaming(null);
            if (next) onChange(next);
          }}
        />
      ) : null}
      {pending ? (
        <ConfirmDeleteDialog
          title={pending.copy.title}
          lines={pending.copy.lines}
          confirmLabel={labels.delete}
          cancelLabel={labels.cancel}
          onCancel={() => {
            pending.resolve(false);
            setPending(null);
          }}
          onConfirm={() => {
            pending.resolve(true);
            setPending(null);
          }}
        />
      ) : null}
    </div>
  );
}

export function BoardCanvas(props: React.ComponentProps<typeof CanvasInner>) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
