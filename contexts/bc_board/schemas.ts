import { z } from "zod";
import type { Board } from "./models";

// ── wejście (zod) ──────────────────────────────────────────────────────────────

export const BoardBodySchema = z
  .object({
    tiles: z.array(
      z.object({
        id: z.string().min(1),
        title: z.string().max(200),
        note: z.string().max(10000),
        x: z.number().finite(),
        y: z.number().finite(),
        w: z.number().finite().min(160),
        h: z.number().finite().min(72),
        frame: z.string().min(1).nullable(),
      })
    ),
    frames: z.array(
      z.object({
        id: z.string().min(1),
        title: z.string().trim().min(1).max(200),
        x: z.number().finite(),
        y: z.number().finite(),
        w: z.number().finite().min(200),
        h: z.number().finite().min(120),
      })
    ),
    edges: z.array(
      z.object({
        id: z.string().min(1),
        source: z.string().min(1),
        target: z.string().min(1),
      })
    ),
  })
  .superRefine((board, ctx) => {
    const ids = [...board.tiles, ...board.frames, ...board.edges].map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate id" });
    }
    const frameIds = new Set(board.frames.map((frame) => frame.id));
    const tileIds = new Set(board.tiles.map((tile) => tile.id));
    for (const tile of board.tiles) {
      if (tile.frame && !frameIds.has(tile.frame)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Unknown frame" });
      }
    }
    for (const edge of board.edges) {
      if (edge.source === edge.target || !tileIds.has(edge.source) || !tileIds.has(edge.target)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Edge must join two different tiles",
        });
      }
    }
  });

export type BoardBody = z.infer<typeof BoardBodySchema>;

/** Normalizacja zwalidowanego body: przycina tytuły kafelków (tytuły ramek przycina sam schemat). */
export function normalizeBoard(body: BoardBody): Board {
  return {
    tiles: body.tiles.map((tile) => ({
      ...tile,
      title: tile.title.trim(),
      frame: tile.frame ?? null,
    })),
    frames: body.frames,
    edges: body.edges,
  };
}

export type ParseBoardResult =
  | { success: true; board: Board }
  | { success: false; message: string };

/** Waliduje dowolne dane (np. zawartość pliku); błąd zwraca jako komunikat (`DomainError` rzuca router: `schemas` nie importuje `lib/errors`). */
export function parseBoard(input: unknown): ParseBoardResult {
  const result = BoardBodySchema.safeParse(input);
  if (!result.success) {
    const tooSmall = result.error.issues.find(
      (issue) => issue.code === "too_small" && issue.origin === "number"
    );
    const message = tooSmall
      ? "Tile or frame is too small"
      : (result.error.issues[0]?.message ?? "Invalid board");
    return { success: false, message };
  }
  return { success: true, board: normalizeBoard(result.data) };
}

// ── wyjście (DTO) ──────────────────────────────────────────────────────────────

export type BoardTileDto = {
  id: string;
  title: string;
  note: string;
  x: number;
  y: number;
  w: number;
  h: number;
  frame: string | null;
};

export type BoardFrameDto = {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type BoardEdgeDto = {
  id: string;
  source: string;
  target: string;
};

export type BoardDto = {
  tiles: BoardTileDto[];
  frames: BoardFrameDto[];
  edges: BoardEdgeDto[];
};

export const EMPTY_BOARD: BoardDto = { tiles: [], frames: [], edges: [] };

export function toBoardDto(board: Board): BoardDto {
  return {
    tiles: board.tiles.map((tile) => ({ ...tile })),
    frames: board.frames.map((frame) => ({ ...frame })),
    edges: board.edges.map((edge) => ({ ...edge })),
  };
}
