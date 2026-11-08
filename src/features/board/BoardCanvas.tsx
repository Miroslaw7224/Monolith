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
import type { Board, BoardFrame } from "@/src/features/board/boardTypes";
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
  }
) {
  const frames = new Map(board.frames.map((frame) => [frame.id, frame]));
  const frameNodes: FrameFlowNode[] = board.frames.map((frame) => ({
    id: frame.id,
    type: "frame",
    position: { x: frame.x, y: frame.y },
    zIndex: -1,
    style: { width: frame.w, height: frame.h },
    data: { frame, onRename: actions.onRename, onDelete: actions.onDelete },
  }));
  const tileNodes: TileFlowNode[] = board.tiles.map((tile) => {
    const frame = tile.frame ? frames.get(tile.frame) : undefined;
    return {
      id: tile.id,
      type: "tile",
      parentId: frame ? frame.id : undefined,
      position: frame ? { x: tile.x - frame.x, y: tile.y - frame.y } : { x: tile.x, y: tile.y },
      style: { width: tile.w, height: tile.h },
      data: { tile, onDelete: actions.onDelete },
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

function CanvasInner({
  board,
  userId,
  lang,
  labels,
  dialogOpen,
  onChange,
  onDialogOpenChange,
  onTileAdded,
  onOpenTile,
}: {
  board: Board;
  userId: string;
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
  const [naming, setNaming] = useState<{ id: string | null; title: string } | null>(null);
  const [pending, setPending] = useState<{
    copy: { title: string; lines: string[] };
    resolve: (ok: boolean) => void;
  } | null>(null);
  const stored = readViewport(userId);
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
  };
  const initial = buildGraph(board, actions);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

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
      const ids = deleted
        .filter((node) => node.type === "tile" || node.type === "frame")
        .map((node) => node.id);
      if (ids.length === 0) return true;
      return confirmDelete(ids);
    },
    [board, lang]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-2 p-2">
        <button
          type="button"
          onClick={() => {
            const added = addTile(board, center(), labels.newTile);
            onChange(added.board);
            onTileAdded(added.tileId);
          }}
        >
          {labels.addTile}
        </button>
        <button type="button" onClick={() => setNaming({ id: null, title: "" })}>
          {labels.addFrame}
        </button>
      </div>
      <div ref={paneRef} className="min-h-0 flex-1">
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
          onMoveEnd={(_event, viewport: BoardViewport) => storeViewport(userId, viewport)}
          onBeforeDelete={onBeforeDelete}
          onNodesDelete={(deleted) =>
            onChange(
              applyDelete(
                board,
                deleted.map((node) => node.id)
              )
            )
          }
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
          onNodeDragStop={(_event, node) => {
            const width = node.measured?.width ?? Number(node.style?.width ?? 0);
            const height = node.measured?.height ?? Number(node.style?.height ?? 0);
            const origin = absoluteOrigin(node, board.frames);
            const next =
              node.type === "tile"
                ? placeTile(board, node.id, { ...origin, w: width, h: height })
                : placeFrame(board, node.id, {
                    x: node.position.x,
                    y: node.position.y,
                    w: width,
                    h: height,
                  });
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
