# Tablica: płótno i lista — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać jedną tablicę na użytkownika: płótno z kafelkami, ramkami i strzałkami oraz listę tych samych kart, zapisane w Firestore.

**Architecture:** Czyste funkcje liczą ramkę kafelka, usunięcie i mutacje planszy. Serwis czyta i zapisuje jeden dokument `users/{uid}/board/main`. Trasa `GET`/`PUT` jest cienka. `BoardTab` trzyma stan, ładuje i zapisuje całość po geście. `BoardCanvas` tylko przekłada gesty React Flow na te funkcje. Lista i okna czytają ten sam stan.

**Tech Stack:** Next.js 14, React 19, TypeScript, Firestore, Zod, Vitest, Testing Library, `@xyflow/react`.

**Spec:** `docs/superpowers/specs/2026-11-08-tablica-plotno-design.md`

Nie dodawać testu Playwright, który przeciąga kafelki. Nie ruszać dolnego paska `MobileNav`. Nie dodawać karty ani licznika tablicy na stronie głównej.

## Pliki

- Utworzyć: `src/features/board/boardTypes.ts` — typy i pusta tablica.
- Utworzyć: `src/features/board/boardLayout.ts` — środek kafelka, próg pół piksela, przesunięcie dzieci ramki.
- Utworzyć: `src/features/board/boardDelete.ts` — plan usunięcia, tekst okna, zastosowanie planu.
- Utworzyć: `src/features/board/boardActions.ts` — dodanie, przesunięcie, strzałki, zmiana tekstu.
- Utworzyć: `src/features/board/boardSchema.ts` — Zod i `parseBoard`.
- Utworzyć: `services/boardService.ts` — odczyt i zapis dokumentu.
- Utworzyć: `app/api/board/route.ts` — `GET` i `PUT`.
- Utworzyć: `src/features/board/BoardList.tsx` — lista po ramkach.
- Utworzyć: `src/features/board/ConfirmDeleteDialog.tsx` — potwierdzenie, fokus na anulowaniu.
- Utworzyć: `src/features/board/TileDialog.tsx` — tytuł i notatka, zamknięcie zapisuje.
- Utworzyć: `src/features/board/FrameNameDialog.tsx` — nazwa ramki, pusty tytuł nie przechodzi.
- Utworzyć: `src/features/board/boardViewport.ts` — widok w `localStorage`.
- Utworzyć: `src/features/board/TileNode.tsx`, `FrameNode.tsx`, `BoardEdge.tsx`, `BoardCanvas.tsx`.
- Utworzyć: `src/features/board/BoardTab.tsx` — odczyt, zapis, błąd, przełącznik widoku.
- Zmienić: `lib/firestore-db.ts` — `boardDoc`.
- Zmienić: `src/translations.ts`, `PlanowanieSidebarContent.tsx`, `PlanowanieView.tsx`, `HomeView.tsx`, `MobileMoreDrawer.tsx`.
- Testy obok, w `tests/unit/features/board/` oraz `tests/unit/services/boardService.test.ts` i `tests/unit/api/board.test.ts`.

---

### Task 1: Geometria tablicy

**Files:**

- Create: `src/features/board/boardTypes.ts`
- Create: `src/features/board/boardLayout.ts`
- Test: `tests/unit/features/board/boardLayout.test.ts`

- [ ] **Step 1: Write the failing test**

Utwórz `tests/unit/features/board/boardLayout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { BoardFrame, BoardTile } from "@/src/features/board/boardTypes";
import { boxChanged, frameAt, movedChildren, withMembership } from "@/src/features/board/boardLayout";

const frameA: BoardFrame = { id: "a", title: "A", x: 0, y: 0, w: 100, h: 100 };
const frameB: BoardFrame = { id: "b", title: "B", x: 50, y: 50, w: 100, h: 100 };

describe("frameAt", () => {
  it("returns the later frame when centers hit both", () => {
    expect(frameAt({ x: 60, y: 60, w: 20, h: 20 }, [frameA, frameB])).toBe("b");
  });

  it("includes the frame edge", () => {
    expect(frameAt({ x: 90, y: 0, w: 20, h: 40 }, [frameA, frameB])).toBe("a");
  });

  it("returns null outside every frame", () => {
    expect(frameAt({ x: 200, y: 200, w: 10, h: 10 }, [frameA])).toBeNull();
  });
});

describe("boxChanged", () => {
  const box = { x: 0, y: 0, w: 10, h: 10 };

  it("ignores a move under half a pixel", () => {
    expect(boxChanged(box, { ...box, x: 0.4 })).toBe(false);
  });

  it("accepts a move of half a pixel", () => {
    expect(boxChanged(box, { ...box, x: 0.5 })).toBe(true);
  });
});

describe("movedChildren and withMembership", () => {
  const tile: BoardTile = {
    id: "t",
    title: "T",
    note: "",
    x: 10,
    y: 10,
    w: 20,
    h: 20,
    frame: "a",
  };

  it("shifts only tiles of the frame", () => {
    const other = { ...tile, id: "o", frame: null };
    expect(movedChildren([tile, other], "a", 5, 7)).toEqual([{ ...tile, x: 15, y: 17 }]);
  });

  it("assigns the frame that contains the center", () => {
    const loose = { ...tile, frame: null, x: 70, y: 70 };
    expect(withMembership([loose], [frameA, frameB])[0].frame).toBe("b");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/features/board/boardLayout.test.ts`

Expected: FAIL, cannot find module `@/src/features/board/boardLayout`.

- [ ] **Step 3: Write minimal implementation**

`src/features/board/boardTypes.ts`:

```ts
export interface BoardTile {
  id: string;
  title: string;
  note: string;
  x: number;
  y: number;
  w: number;
  h: number;
  frame: string | null;
}

export interface BoardFrame {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoardEdge {
  id: string;
  source: string;
  target: string;
}

export interface Board {
  tiles: BoardTile[];
  frames: BoardFrame[];
  edges: BoardEdge[];
}

export const EMPTY_BOARD: Board = { tiles: [], frames: [], edges: [] };

export interface BoardBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
```

`src/features/board/boardLayout.ts`:

```ts
import type { BoardBox, BoardFrame, BoardTile } from "@/src/features/board/boardTypes";

export function frameAt(box: BoardBox, frames: BoardFrame[]): string | null {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const hit = [...frames]
    .reverse()
    .find(
      (frame) => cx >= frame.x && cx <= frame.x + frame.w && cy >= frame.y && cy <= frame.y + frame.h
    );
  return hit ? hit.id : null;
}

export function boxChanged(before: BoardBox, after: BoardBox): boolean {
  return (["x", "y", "w", "h"] as const).some(
    (key) => Math.abs(after[key] - before[key]) >= 0.5
  );
}

export function movedChildren(
  tiles: BoardTile[],
  frameId: string,
  dx: number,
  dy: number
): BoardTile[] {
  return tiles
    .filter((tile) => tile.frame === frameId)
    .map((tile) => ({ ...tile, x: tile.x + dx, y: tile.y + dy }));
}

export function withMembership(tiles: BoardTile[], frames: BoardFrame[]): BoardTile[] {
  return tiles.map((tile) => ({ ...tile, frame: frameAt(tile, frames) }));
}

export function centeredBox(center: { x: number; y: number }, w: number, h: number): BoardBox {
  return { x: center.x - w / 2, y: center.y - h / 2, w, h };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/features/board/boardLayout.test.ts`

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/board/boardTypes.ts src/features/board/boardLayout.ts tests/unit/features/board/boardLayout.test.ts
git commit -m "$(cat <<'EOF'
feat: add board geometry helpers

EOF
)"
```

---

### Task 2: Plan usunięcia

**Files:**

- Create: `src/features/board/boardDelete.ts`
- Test: `tests/unit/features/board/boardDelete.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/features/board/boardDelete.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Board } from "@/src/features/board/boardTypes";
import { applyDelete, deleteCopy, deletePlan } from "@/src/features/board/boardDelete";

const board: Board = {
  frames: [
    { id: "f1", title: "Rdzeń", x: 0, y: 0, w: 400, h: 300 },
    { id: "f2", title: "Bok", x: 300, y: 0, w: 200, h: 200 },
  ],
  tiles: [
    { id: "t1", title: "Płatności", note: "", x: 320, y: 20, w: 20, h: 20, frame: "f1" },
    { id: "t2", title: "Luz", note: "", x: 500, y: 500, w: 40, h: 40, frame: "f1" },
  ],
  edges: [
    { id: "e1", source: "t1", target: "t2" },
    { id: "e2", source: "t2", target: "t1" },
  ],
};

describe("deletePlan", () => {
  it("drops arrows that touch a deleted tile and keeps the other tile", () => {
    const plan = deletePlan(["t1"], board);
    expect(plan.edgeIds).toEqual(["e1", "e2"]);
    expect(plan.tiles.map((tile) => tile.id)).toEqual(["t1"]);
    expect(applyDelete(board, ["t1"]).tiles.map((tile) => tile.id)).toEqual(["t2"]);
    expect(applyDelete(board, ["t1"]).edges).toEqual([]);
  });

  it("keeps tiles when a frame is deleted and lands them by center", () => {
    const plan = deletePlan(["f1"], board);
    expect(plan.frames.map((frame) => frame.id)).toEqual(["f1"]);
    expect(plan.landing).toEqual([
      { tileId: "t1", frame: "f2", frameTitle: "Bok" },
      { tileId: "t2", frame: null, frameTitle: null },
    ]);
    const next = applyDelete(board, ["f1"]);
    expect(next.frames.map((frame) => frame.id)).toEqual(["f2"]);
    expect(next.tiles.find((tile) => tile.id === "t1")?.frame).toBe("f2");
    expect(next.tiles.find((tile) => tile.id === "t2")?.frame).toBeNull();
  });
});

describe("deleteCopy", () => {
  it("names the tile and the arrows that go with it", () => {
    const copy = deleteCopy(deletePlan(["t1"], board), "pl");
    expect(copy.title).toBe("Usunąć kafelek?");
    expect(copy.lines.join(" ")).toContain("Płatności");
    expect(copy.lines.join(" ")).toContain("strzałki: 2");
  });

  it("names the frame a tile lands in", () => {
    const copy = deleteCopy(deletePlan(["f1"], board), "pl");
    expect(copy.lines.join(" ")).toContain("Bok");
    expect(copy.lines.join(" ")).not.toContain("f2");
  });
});
```

Środek `t1` to `(330, 30)`: po usunięciu `f1` wpada w `f2`. Środek `t2` to `(520, 520)`: zostaje poza ramkami.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/features/board/boardDelete.test.ts`

Expected: FAIL, cannot find module `@/src/features/board/boardDelete`.

- [ ] **Step 3: Write minimal implementation**

`src/features/board/boardDelete.ts`:

```ts
import type { Board, BoardFrame, BoardTile } from "@/src/features/board/boardTypes";
import { frameAt } from "@/src/features/board/boardLayout";

export interface DeletePlan {
  tiles: BoardTile[];
  frames: BoardFrame[];
  edgeIds: string[];
  landing: { tileId: string; frame: string | null; frameTitle: string | null }[];
}

export function deletePlan(ids: string[], board: Board): DeletePlan {
  const selected = new Set(ids);
  const tiles = board.tiles.filter((tile) => selected.has(tile.id));
  const frames = board.frames.filter((frame) => selected.has(frame.id));
  const tileIds = new Set(tiles.map((tile) => tile.id));
  const frameIds = new Set(frames.map((frame) => frame.id));
  const edgeIds = board.edges
    .filter((edge) => tileIds.has(edge.source) || tileIds.has(edge.target))
    .map((edge) => edge.id);
  const remaining = board.frames.filter((frame) => !frameIds.has(frame.id));
  const remainingById = new Map(remaining.map((frame) => [frame.id, frame.title]));
  const landing = board.tiles
    .filter((tile) => tile.frame && frameIds.has(tile.frame) && !tileIds.has(tile.id))
    .map((tile) => {
      const frame = frameAt(tile, remaining);
      return {
        tileId: tile.id,
        frame,
        frameTitle: frame ? (remainingById.get(frame) ?? null) : null,
      };
    });
  return { tiles, frames, edgeIds, landing };
}

export function applyDelete(board: Board, ids: string[]): Board {
  const plan = deletePlan(ids, board);
  const tileIds = new Set(plan.tiles.map((tile) => tile.id));
  const frameIds = new Set(plan.frames.map((frame) => frame.id));
  const edgeIds = new Set(plan.edgeIds);
  const landing = new Map(plan.landing.map((item) => [item.tileId, item.frame]));
  return {
    tiles: board.tiles
      .filter((tile) => !tileIds.has(tile.id))
      .map((tile) => (landing.has(tile.id) ? { ...tile, frame: landing.get(tile.id)! } : tile)),
    frames: board.frames.filter((frame) => !frameIds.has(frame.id)),
    edges: board.edges.filter((edge) => !edgeIds.has(edge.id)),
  };
}

export function deleteCopy(plan: DeletePlan, lang: "pl" | "en"): { title: string; lines: string[] } {
  const pl = lang === "pl";
  if (plan.tiles.length + plan.frames.length > 1) {
    const lines = [
      pl
        ? `Kafelki: ${plan.tiles.length}, ramki: ${plan.frames.length}.`
        : `Tiles: ${plan.tiles.length}, frames: ${plan.frames.length}.`,
    ];
    if (plan.edgeIds.length > 0) {
      lines.push(
        pl
          ? `Razem z kafelkami znikną strzałki: ${plan.edgeIds.length}.`
          : `Arrows removed with the tiles: ${plan.edgeIds.length}.`
      );
    }
    return { title: pl ? "Usunąć zaznaczone?" : "Delete the selection?", lines };
  }
  if (plan.frames.length === 1) {
    const frame = plan.frames[0];
    const lines = [
      pl ? `Ramka „${frame.title}” zniknie.` : `Frame “${frame.title}” will be removed.`,
    ];
    if (plan.landing.length > 0) {
      const outside = plan.landing.filter((item) => item.frame === null).length;
      const grouped = new Map<string, number>();
      for (const item of plan.landing) {
        if (item.frame) grouped.set(item.frame, (grouped.get(item.frame) ?? 0) + 1);
      }
      if (grouped.size === 0) {
        lines.push(
          pl
            ? `Kafelki w ramce (${plan.landing.length}) zostaną na tablicy, poza ramkami.`
            : `Tiles in the frame (${plan.landing.length}) stay on the board, outside frames.`
        );
      } else {
        const parts = [];
        if (outside > 0) parts.push(pl ? `${outside} poza ramkami` : `${outside} outside frames`);
        for (const [frameId, count] of grouped) {
          const title = plan.landing.find((item) => item.frame === frameId)?.frameTitle ?? frameId;
          parts.push(pl ? `${count} w ramce „${title}”` : `${count} in frame “${title}”`);
        }
        lines.push(
          pl
            ? `Kafelki w ramce (${plan.landing.length}) zostaną na tablicy: ${parts.join(", ")}.`
            : `Tiles in the frame (${plan.landing.length}) stay on the board: ${parts.join(", ")}.`
        );
      }
    }
    return { title: pl ? "Usunąć ramkę?" : "Delete the frame?", lines };
  }
  const title = plan.tiles[0]?.title ?? "";
  const lines = [
    pl ? `„${title}” zniknie z tablicy.` : `“${title}” will leave the board.`,
  ];
  if (plan.edgeIds.length > 0) {
    lines.push(
      pl
        ? `Razem z nim znikną strzałki: ${plan.edgeIds.length}.`
        : `Arrows removed with it: ${plan.edgeIds.length}.`
    );
  }
  return { title: pl ? "Usunąć kafelek?" : "Delete the tile?", lines };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/features/board/boardDelete.test.ts`

Expected: PASS, 4 tests. The frame sentence contains `Bok`, not `f2`.

- [ ] **Step 5: Commit**

```bash
git add src/features/board/boardDelete.ts tests/unit/features/board/boardDelete.test.ts
git commit -m "$(cat <<'EOF'
feat: add board delete plan

EOF
)"
```

---

### Task 3: Mutacje planszy

**Files:**

- Create: `src/features/board/boardActions.ts`
- Test: `tests/unit/features/board/boardActions.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/features/board/boardActions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EMPTY_BOARD, type Board } from "@/src/features/board/boardTypes";
import {
  addFrame,
  addTile,
  connectTiles,
  placeFrame,
  placeTile,
  reconnectEdge,
  removeEdge,
} from "@/src/features/board/boardActions";

describe("board actions", () => {
  it("adds a 240×120 tile around the center and opens no frame when the board is empty", () => {
    const { board, tileId } = addTile(EMPTY_BOARD, { x: 100, y: 80 }, "Nowy kafelek");
    const tile = board.tiles[0];
    expect(tile.id).toBe(tileId);
    expect(tile.w).toBe(240);
    expect(tile.h).toBe(120);
    expect(tile.x).toBe(100 - 120);
    expect(tile.y).toBe(80 - 60);
    expect(tile.frame).toBeNull();
    expect(tile.title).toBe("Nowy kafelek");
  });

  it("puts a new frame under tiles whose centers it covers", () => {
    const first = addTile(EMPTY_BOARD, { x: 100, y: 80 }, "A").board;
    const next = addFrame(first, { x: 100, y: 80 }, "  Grupa  ");
    expect(next.frames[0].title).toBe("Grupa");
    expect(next.frames[0].w).toBe(520);
    expect(next.frames[0].h).toBe(180);
    expect(next.tiles[0].frame).toBe(next.frames[0].id);
  });

  it("does not write a tile nudge under half a pixel", () => {
    const { board, tileId } = addTile(EMPTY_BOARD, { x: 0, y: 0 }, "A");
    const tile = board.tiles[0];
    expect(placeTile(board, tileId, { ...tile, x: tile.x + 0.4 })).toBeNull();
  });

  it("moves a frame's tiles and recomputes membership", () => {
    let board: Board = addFrame(EMPTY_BOARD, { x: 260, y: 90 }, "Ramka").board;
    const frame = board.frames[0];
    const added = addTile(board, { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 }, "W");
    board = added.board;
    const moved = placeFrame(board, frame.id, { ...frame, x: frame.x + 40, y: frame.y });
    expect(moved).not.toBeNull();
    expect(moved!.tiles[0].x).toBe(board.tiles[0].x + 40);
    expect(moved!.tiles[0].frame).toBe(frame.id);
  });

  it("refuses an arrow that does not join two different tiles", () => {
    const { board, tileId } = addTile(EMPTY_BOARD, { x: 0, y: 0 }, "A");
    expect(connectTiles(board, tileId, tileId)).toBeNull();
    expect(connectTiles(board, tileId, "missing")).toBeNull();
  });

  it("reconnects and removes an arrow", () => {
    let board = addTile(EMPTY_BOARD, { x: 0, y: 0 }, "A").board;
    const a = board.tiles[0].id;
    board = addTile(board, { x: 400, y: 0 }, "B").board;
    const b = board.tiles[1].id;
    board = addTile(board, { x: 800, y: 0 }, "C").board;
    const c = board.tiles[2].id;
    board = connectTiles(board, a, b)!;
    const edgeId = board.edges[0].id;
    const moved = reconnectEdge(board, edgeId, a, c);
    expect(moved!.edges[0]).toMatchObject({ id: edgeId, source: a, target: c });
    expect(removeEdge(moved!, edgeId).edges).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/features/board/boardActions.test.ts`

Expected: FAIL, cannot find module `@/src/features/board/boardActions`.

- [ ] **Step 3: Write minimal implementation**

`src/features/board/boardActions.ts`:

```ts
import type { Board, BoardBox } from "@/src/features/board/boardTypes";
import { boxChanged, centeredBox, frameAt, withMembership } from "@/src/features/board/boardLayout";

export const NEW_TILE = { w: 240, h: 120 };
export const NEW_FRAME = { w: 520, h: 180 };

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function addTile(
  board: Board,
  center: { x: number; y: number },
  title: string
): { board: Board; tileId: string } {
  const id = newId("t");
  const box = centeredBox(center, NEW_TILE.w, NEW_TILE.h);
  const tile = {
    id,
    title,
    note: "",
    ...box,
    frame: frameAt(box, board.frames),
  };
  return { tileId: id, board: { ...board, tiles: [...board.tiles, tile] } };
}

export function addFrame(board: Board, center: { x: number; y: number }, title: string): Board {
  const id = newId("f");
  const box = centeredBox(center, NEW_FRAME.w, NEW_FRAME.h);
  const frames = [...board.frames, { id, title: title.trim(), ...box }];
  return { ...board, frames, tiles: withMembership(board.tiles, frames) };
}

export function placeTile(board: Board, id: string, box: BoardBox): Board | null {
  const tile = board.tiles.find((item) => item.id === id);
  if (!tile || !boxChanged(tile, box)) return null;
  const next = { ...tile, ...box, frame: frameAt({ ...tile, ...box }, board.frames) };
  return { ...board, tiles: board.tiles.map((item) => (item.id === id ? next : item)) };
}

export function placeFrame(board: Board, id: string, box: BoardBox): Board | null {
  const frame = board.frames.find((item) => item.id === id);
  if (!frame || !boxChanged(frame, box)) return null;
  const dx = box.x - frame.x;
  const dy = box.y - frame.y;
  const frames = board.frames.map((item) => (item.id === id ? { ...item, ...box } : item));
  const shifted = board.tiles.map((tile) =>
    tile.frame === id ? { ...tile, x: tile.x + dx, y: tile.y + dy } : tile
  );
  return { ...board, frames, tiles: withMembership(shifted, frames) };
}

export function connectTiles(board: Board, source: string, target: string): Board | null {
  if (source === target) return null;
  const ids = new Set(board.tiles.map((tile) => tile.id));
  if (!ids.has(source) || !ids.has(target)) return null;
  return { ...board, edges: [...board.edges, { id: newId("e"), source, target }] };
}

export function reconnectEdge(
  board: Board,
  id: string,
  source: string,
  target: string
): Board | null {
  if (source === target) return null;
  const ids = new Set(board.tiles.map((tile) => tile.id));
  if (!ids.has(source) || !ids.has(target)) return null;
  if (!board.edges.some((edge) => edge.id === id)) return null;
  return {
    ...board,
    edges: board.edges.map((edge) => (edge.id === id ? { ...edge, source, target } : edge)),
  };
}

export function removeEdge(board: Board, id: string): Board {
  return { ...board, edges: board.edges.filter((edge) => edge.id !== id) };
}

export function updateTileText(board: Board, id: string, title: string, note: string): Board | null {
  if (!board.tiles.some((tile) => tile.id === id)) return null;
  return {
    ...board,
    tiles: board.tiles.map((tile) =>
      tile.id === id
        ? { ...tile, title: title.trim().slice(0, 200), note: note.slice(0, 10000) }
        : tile
    ),
  };
}

export function renameFrame(board: Board, id: string, title: string): Board | null {
  const trimmed = title.trim().slice(0, 200);
  if (!trimmed || !board.frames.some((frame) => frame.id === id)) return null;
  return {
    ...board,
    frames: board.frames.map((frame) => (frame.id === id ? { ...frame, title: trimmed } : frame)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/features/board/boardActions.test.ts`

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/board/boardActions.ts tests/unit/features/board/boardActions.test.ts
git commit -m "$(cat <<'EOF'
feat: add board mutation actions

EOF
)"
```

---

### Task 4: Walidacja dokumentu

**Files:**

- Create: `src/features/board/boardSchema.ts`
- Test: `tests/unit/features/board/boardSchema.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/features/board/boardSchema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import { parseBoard } from "@/src/features/board/boardSchema";

const tile = {
  id: "t1",
  title: "  Kafelek  ",
  note: "",
  x: 0,
  y: 0,
  w: 160,
  h: 72,
  frame: null,
};

describe("parseBoard", () => {
  it("trims a tile title and accepts an empty note", () => {
    const board = parseBoard({ tiles: [tile], frames: [], edges: [] });
    expect(board.tiles[0].title).toBe("Kafelek");
  });

  it("rejects an unknown frame, a small tile, and a bad arrow", () => {
    expect(() =>
      parseBoard({ tiles: [{ ...tile, frame: "missing" }], frames: [], edges: [] })
    ).toThrow(DomainError);
    expect(() => parseBoard({ tiles: [{ ...tile, w: 159 }], frames: [], edges: [] })).toThrow(
      /too small|160/
    );
    expect(() =>
      parseBoard({
        tiles: [tile],
        frames: [],
        edges: [{ id: "e", source: "t1", target: "t1" }],
      })
    ).toThrow(/two different tiles/);
  });

  it("rejects a duplicate id", () => {
    expect(() =>
      parseBoard({
        tiles: [tile],
        frames: [],
        edges: [{ id: "t1", source: "t1", target: "t1" }],
      })
    ).toThrow(/Duplicate id/);
  });

  it("rejects a blank frame title", () => {
    expect(() =>
      parseBoard({
        tiles: [],
        frames: [{ id: "f", title: "   ", x: 0, y: 0, w: 200, h: 120 }],
        edges: [],
      })
    ).toThrow(DomainError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/features/board/boardSchema.test.ts`

Expected: FAIL, cannot find module `@/src/features/board/boardSchema`.

- [ ] **Step 3: Write minimal implementation**

`src/features/board/boardSchema.ts`:

```ts
import { z } from "zod";
import { DomainError } from "@/lib/errors";
import type { Board } from "@/src/features/board/boardTypes";

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

export function parseBoard(input: unknown): Board {
  const result = BoardBodySchema.safeParse(input);
  if (!result.success) {
    const tooSmall = result.error.issues.find((issue) => issue.code === "too_small");
    const message = tooSmall
      ? "Tile or frame is too small"
      : (result.error.issues[0]?.message ?? "Invalid board");
    throw new DomainError(message, 400);
  }
  return {
    tiles: result.data.tiles.map((tile) => ({ ...tile, title: tile.title.trim() })),
    frames: result.data.frames,
    edges: result.data.edges,
  };
}
```

The small-tile assertion is `toThrow(/too small|160/)`. `parseBoard` throws `Tile or frame is too small`, which matches `too small`. Keep that message.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/features/board/boardSchema.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/board/boardSchema.ts tests/unit/features/board/boardSchema.test.ts
git commit -m "$(cat <<'EOF'
feat: validate a board document

EOF
)"
```

---

### Task 5: Serwis Firestore

**Files:**

- Modify: `lib/firestore-db.ts` (obok `mindMapsCol`)
- Create: `services/boardService.ts`
- Test: `tests/unit/services/boardService.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/services/boardService.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { DomainError } from "../../../lib/errors.js";

const mockBoardDoc = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/firestore-db.js", () => ({
  boardDoc: (...args: unknown[]) => mockBoardDoc(...args),
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => ({ __sv: "ts" }) },
}));

import { getBoard, saveBoard } from "../../../services/boardService.js";

function setupDoc() {
  let stored: Record<string, unknown> | undefined;
  mockBoardDoc.mockReturnValue({
    async get() {
      if (!stored) return { exists: false, data: () => undefined };
      return { exists: true, data: () => stored };
    },
    async set(data: Record<string, unknown>) {
      stored = { ...data };
    },
  });
}

describe("boardService", () => {
  beforeEach(() => mockBoardDoc.mockReset());

  it("returns three empty lists when the document is missing", async () => {
    setupDoc();
    await expect(getBoard("u1")).resolves.toEqual({ tiles: [], frames: [], edges: [] });
  });

  it("reads back a saved board", async () => {
    setupDoc();
    const saved = await saveBoard("u1", {
      tiles: [
        { id: "t1", title: "A", note: "", x: 0, y: 0, w: 240, h: 120, frame: null },
      ],
      frames: [],
      edges: [],
    });
    expect(saved.tiles[0].title).toBe("A");
    const loaded = await getBoard("u1");
    expect(loaded.tiles[0].id).toBe("t1");
  });

  it("rejects an unknown frame", async () => {
    setupDoc();
    await expect(
      saveBoard("u1", {
        tiles: [
          { id: "t1", title: "A", note: "", x: 0, y: 0, w: 240, h: 120, frame: "nope" },
        ],
        frames: [],
        edges: [],
      })
    ).rejects.toThrow(DomainError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/services/boardService.test.ts`

Expected: FAIL, cannot find module `../../../services/boardService.js`.

- [ ] **Step 3: Write minimal implementation**

W `lib/firestore-db.ts`, za `mindMapsCol`:

```ts
export function boardDoc(userId: string) {
  return db().collection(COLLECTION_USERS).doc(String(userId)).collection("board").doc("main");
}
```

`services/boardService.ts`:

```ts
import { FieldValue } from "firebase-admin/firestore";
import { boardDoc } from "@/lib/firestore-db";
import { EMPTY_BOARD, type Board } from "@/src/features/board/boardTypes";
import { parseBoard } from "@/src/features/board/boardSchema";

export async function getBoard(userId: string): Promise<Board> {
  const snap = await boardDoc(userId).get();
  if (!snap.exists) return EMPTY_BOARD;
  return parseBoard(snap.data());
}

export async function saveBoard(userId: string, input: unknown): Promise<Board> {
  const board = parseBoard(input);
  await boardDoc(userId).set({
    tiles: board.tiles,
    frames: board.frames,
    edges: board.edges,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return board;
}
```

`getBoard` na istniejącym dokumencie woła `parseBoard`. Zapisany dokument ma `updatedAt`, którego schemat nie zna. `BoardBodySchema` domyślnie odrzuca obce klucze. Dodaj do obiektu schematu `.strip()` nie wystarczy przy domyślnym Zod (nieznane klucze są obcinane w Zod 3, w Zod 4 mogą być błędem). Ten projekt ma `zod` `^4.3.6`. W Zod 4 nieznane klucze są usuwane przez `z.object` tylko gdy obiekt nie jest strict. Sprawdź to testem z kroku 4: `getBoard` po `saveBoard` musi przejść. Jeśli Zod 4 zgłosi nierozpoznany klucz `updatedAt`, w `getBoard` przekaż do `parseBoard` wyłącznie `{ tiles, frames, edges }`:

```ts
const data = snap.data() as { tiles: unknown; frames: unknown; edges: unknown };
return parseBoard({ tiles: data.tiles, frames: data.frames, edges: data.edges });
```

Wpisz tę wersję od razu, żeby odczyt nie zależał od `updatedAt`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/services/boardService.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/firestore-db.ts services/boardService.ts tests/unit/services/boardService.test.ts
git commit -m "$(cat <<'EOF'
feat: store one board document per user

EOF
)"
```

---

### Task 6: Trasa API

**Files:**

- Create: `app/api/board/route.ts`
- Test: `tests/unit/api/board.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/api/board.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetAuthUserId = vi.hoisted(() => vi.fn());
const mockGetBoard = vi.hoisted(() => vi.fn());
const mockSaveBoard = vi.hoisted(() => vi.fn());

vi.mock("@/lib/getAuth", () => ({ getAuthUserId: mockGetAuthUserId }));
vi.mock("@/services/boardService", () => ({
  getBoard: mockGetBoard,
  saveBoard: mockSaveBoard,
}));

import { GET, PUT } from "@/app/api/board/route";

function makeRequest(method: string, body?: unknown): NextRequest {
  const headers: Record<string, string> = { authorization: "Bearer valid" };
  if (body) headers["content-type"] = "application/json";
  return new NextRequest("http://localhost/api/board", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("/api/board", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUserId.mockResolvedValue({ uid: "user-1" });
  });

  it("returns 401 for a guest", async () => {
    mockGetAuthUserId.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    expect((await GET(makeRequest("GET"))).status).toBe(401);
    expect((await PUT(makeRequest("PUT", { tiles: [], frames: [], edges: [] }))).status).toBe(401);
  });

  it("returns the board for a signed-in user", async () => {
    mockGetBoard.mockResolvedValue({ tiles: [], frames: [], edges: [] });
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tiles: [], frames: [], edges: [] });
    expect(mockGetBoard).toHaveBeenCalledWith("user-1");
  });

  it("returns 400 for a tile that is too small and does not save", async () => {
    const res = await PUT(
      makeRequest("PUT", {
        tiles: [{ id: "t", title: "A", note: "", x: 0, y: 0, w: 10, h: 10, frame: null }],
        frames: [],
        edges: [],
      })
    );
    expect(res.status).toBe(400);
    expect(mockSaveBoard).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/api/board.test.ts`

Expected: FAIL, cannot find module `@/app/api/board/route`.

- [ ] **Step 3: Write minimal implementation**

`app/api/board/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/getAuth";
import { handleServiceError } from "@/lib/apiError";
import { parseBody } from "@/lib/parseBody";
import { BoardBodySchema } from "@/src/features/board/boardSchema";
import { getBoard, saveBoard } from "@/services/boardService";

export async function GET(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await getBoard(auth.uid));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthUserId(request);
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(request, BoardBodySchema);
  if (parsed.success === false) return parsed.response;
  try {
    return NextResponse.json(await saveBoard(auth.uid, parsed.data));
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/api/board.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/board/route.ts tests/unit/api/board.test.ts
git commit -m "$(cat <<'EOF'
feat: add board read and write routes

EOF
)"
```

---

### Task 7: Lista

**Files:**

- Create: `src/features/board/BoardList.tsx`
- Test: `tests/unit/features/board/BoardList.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/unit/features/board/BoardList.test.tsx`:

```tsx
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Board } from "@/src/features/board/boardTypes";
import { BoardList } from "@/src/features/board/BoardList";

const board: Board = {
  frames: [
    { id: "f", title: "Rdzeń", x: 0, y: 0, w: 400, h: 300 },
    { id: "empty", title: "Pusta", x: 0, y: 0, w: 200, h: 120 },
  ],
  tiles: [
    { id: "t1", title: "Płatności", note: "notatka", x: 0, y: 0, w: 160, h: 72, frame: "f" },
    { id: "t2", title: "Luz", note: "", x: 0, y: 0, w: 160, h: 72, frame: null },
  ],
  edges: [],
};

describe("BoardList", () => {
  it("groups tiles under frames and hides the loose section when it is empty", () => {
    const onlyFramed: Board = { ...board, tiles: [board.tiles[0]] };
    render(<BoardList board={onlyFramed} outsideLabel="Poza ramkami" onOpen={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Rdzeń" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pusta" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Poza ramkami" })).not.toBeInTheDocument();
  });

  it("shows loose tiles and opens a tile from its title", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<BoardList board={board} outsideLabel="Poza ramkami" onOpen={onOpen} />);
    expect(screen.getByRole("heading", { name: "Poza ramkami" })).toBeInTheDocument();
    expect(screen.getByText("notatka")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Płatności" }));
    expect(onOpen).toHaveBeenCalledWith("t1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/features/board/BoardList.test.tsx`

Expected: FAIL, cannot find module `@/src/features/board/BoardList`.

- [ ] **Step 3: Write minimal implementation**

`src/features/board/BoardList.tsx`:

```tsx
import React from "react";
import type { Board } from "@/src/features/board/boardTypes";

export function BoardList({
  board,
  outsideLabel,
  onOpen,
}: {
  board: Board;
  outsideLabel: string;
  onOpen: (tileId: string) => void;
}) {
  const frameIds = new Set(board.frames.map((frame) => frame.id));
  const sections = [
    ...board.frames.map((frame) => ({
      id: frame.id,
      title: frame.title,
      tiles: board.tiles.filter((tile) => tile.frame === frame.id),
    })),
    {
      id: "loose",
      title: outsideLabel,
      tiles: board.tiles.filter((tile) => !tile.frame || !frameIds.has(tile.frame)),
    },
  ].filter((section) => section.id !== "loose" || section.tiles.length > 0);

  return (
    <div className="space-y-6 overflow-y-auto p-4">
      {sections.map((section) => (
        <section key={section.id}>
          <h3 className="text-sm font-bold text-[var(--text)]">{section.title}</h3>
          <ul className="mt-2 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
            {section.tiles.map((tile) => (
              <li key={tile.id} className="flex gap-4 p-3">
                <button
                  type="button"
                  className="text-sm font-semibold text-[var(--accent)]"
                  onClick={() => onOpen(tile.id)}
                >
                  {tile.title}
                </button>
                <span className="text-sm text-[var(--text2)]">{tile.note}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/features/board/BoardList.test.tsx`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/board/BoardList.tsx tests/unit/features/board/BoardList.test.tsx
git commit -m "$(cat <<'EOF'
feat: list board tiles by frame

EOF
)"
```

---

### Task 8: Okna kafelka, ramki i usunięcia

**Files:**

- Create: `src/features/board/ConfirmDeleteDialog.tsx`
- Create: `src/features/board/TileDialog.tsx`
- Create: `src/features/board/FrameNameDialog.tsx`
- Test: `tests/unit/features/board/BoardDialogs.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/unit/features/board/BoardDialogs.test.tsx`:

```tsx
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDeleteDialog } from "@/src/features/board/ConfirmDeleteDialog";
import { FrameNameDialog } from "@/src/features/board/FrameNameDialog";
import { TileDialog } from "@/src/features/board/TileDialog";

describe("board dialogs", () => {
  it("focuses the cancel button of the delete dialog", () => {
    render(
      <ConfirmDeleteDialog
        title="Usunąć kafelek?"
        lines={["„A” zniknie z tablicy."]}
        confirmLabel="Usuń"
        cancelLabel="Anuluj"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Anuluj" })).toHaveFocus();
  });

  it("does not submit a blank frame name", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <FrameNameDialog
        title="Nazwa ramki"
        submitLabel="Zapisz"
        cancelLabel="Anuluj"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(onSubmit).not.toHaveBeenCalled();
    await user.type(screen.getByRole("textbox"), "  Rdzeń  ");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(onSubmit).toHaveBeenCalledWith("Rdzeń");
  });

  it("saves the tile when the window closes", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <TileDialog
        tile={{ id: "t", title: "A", note: "", x: 0, y: 0, w: 160, h: 72, frame: null }}
        titleLabel="Tytuł"
        noteLabel="Notatka"
        closeLabel="Zamknij"
        onSave={onSave}
      />
    );
    const fields = screen.getAllByRole("textbox");
    await user.clear(fields[0]);
    await user.type(fields[0], "Nowy");
    await user.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(onSave).toHaveBeenCalledWith({ title: "Nowy", note: "" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/features/board/BoardDialogs.test.tsx`

Expected: FAIL, cannot find the dialog modules.

- [ ] **Step 3: Write minimal implementation**

`src/features/board/ConfirmDeleteDialog.tsx`:

```tsx
import React from "react";

export function ConfirmDeleteDialog({
  title,
  lines,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  lines: string[];
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="dialog" aria-labelledby="board-delete-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--surface)] p-4">
        <h2 id="board-delete-title" className="text-base font-bold text-[var(--text)]">
          {title}
        </h2>
        {lines.map((line) => (
          <p key={line} className="mt-2 text-sm text-[var(--text2)]">
            {line}
          </p>
        ))}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-lg px-3 py-2 text-sm" autoFocus onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-white" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

`src/features/board/FrameNameDialog.tsx`:

```tsx
import React, { useState } from "react";

export function FrameNameDialog({
  title,
  initialTitle = "",
  submitLabel,
  cancelLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  initialTitle?: string;
  submitLabel: string;
  cancelLabel: string;
  onSubmit: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialTitle);
  return (
    <div role="dialog" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        className="w-full max-w-md rounded-xl bg-[var(--surface)] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = value.trim();
          if (!trimmed) return;
          onSubmit(trimmed);
        }}
      >
        <h2 className="text-base font-bold text-[var(--text)]">{title}</h2>
        <input
          className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="submit">{submitLabel}</button>
        </div>
      </form>
    </div>
  );
}
```

`src/features/board/TileDialog.tsx`:

```tsx
import React, { useState } from "react";
import type { BoardTile } from "@/src/features/board/boardTypes";

export function TileDialog({
  tile,
  titleLabel,
  noteLabel,
  closeLabel,
  onSave,
}: {
  tile: BoardTile;
  titleLabel: string;
  noteLabel: string;
  closeLabel: string;
  onSave: (patch: { title: string; note: string }) => void;
}) {
  const [title, setTitle] = useState(tile.title);
  const [note, setNote] = useState(tile.note);
  return (
    <div role="dialog" aria-label={titleLabel} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--surface)] p-4">
        <label className="block text-sm text-[var(--text)]">
          {titleLabel}
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="mt-3 block text-sm text-[var(--text)]">
          {noteLabel}
          <textarea
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => onSave({ title: title.trim().slice(0, 200), note: note.slice(0, 10000) })}
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/features/board/BoardDialogs.test.tsx`

Expected: PASS, 3 tests. If `autoFocus` does not move focus in jsdom, call `cancelRef.current?.focus()` in `useEffect` instead of the `autoFocus` attribute and rerun this test.

- [ ] **Step 5: Commit**

```bash
git add src/features/board/ConfirmDeleteDialog.tsx src/features/board/FrameNameDialog.tsx src/features/board/TileDialog.tsx tests/unit/features/board/BoardDialogs.test.tsx
git commit -m "$(cat <<'EOF'
feat: add board tile, frame, and delete dialogs

EOF
)"
```

---

### Task 9: Pamięć widoku

**Files:**

- Create: `src/features/board/boardViewport.ts`
- Test: `tests/unit/features/board/boardViewport.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/features/board/boardViewport.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { readViewport, storeViewport } from "@/src/features/board/boardViewport";

afterEach(() => localStorage.clear());

describe("boardViewport", () => {
  it("returns null when nothing is stored", () => {
    expect(readViewport("u1")).toBeNull();
  });

  it("round-trips the viewport for that user only", () => {
    storeViewport("u1", { x: 10, y: 20, zoom: 0.8 });
    expect(readViewport("u1")).toEqual({ x: 10, y: 20, zoom: 0.8 });
    expect(readViewport("u2")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/features/board/boardViewport.test.ts`

Expected: FAIL, cannot find module `@/src/features/board/boardViewport`.

- [ ] **Step 3: Write minimal implementation**

`src/features/board/boardViewport.ts`:

```ts
export interface BoardViewport {
  x: number;
  y: number;
  zoom: number;
}

function key(userId: string): string {
  return `board-viewport:${userId}`;
}

export function readViewport(userId: string): BoardViewport | null {
  const raw = localStorage.getItem(key(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BoardViewport;
    if (![parsed.x, parsed.y, parsed.zoom].every((value) => Number.isFinite(value))) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeViewport(userId: string, viewport: BoardViewport): void {
  localStorage.setItem(key(userId), JSON.stringify(viewport));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/features/board/boardViewport.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/board/boardViewport.ts tests/unit/features/board/boardViewport.test.ts
git commit -m "$(cat <<'EOF'
feat: remember the board viewport per user

EOF
)"
```

---

### Task 10: Płótno

**Files:**

- Create: `src/features/board/TileNode.tsx`
- Create: `src/features/board/FrameNode.tsx`
- Create: `src/features/board/BoardEdge.tsx`
- Create: `src/features/board/BoardCanvas.tsx`
- Test: `tests/unit/features/board/BoardCanvas.test.tsx`

Płótno nie jest przeciągane w teście. Test sprawdza, że przyciski dodają kafelek i ramkę przez przekazane callbacki oraz że otwarte okno blokuje skrót usuwania. Geometria zostaje w taskach 1–3.

- [ ] **Step 1: Write the failing test**

`tests/unit/features/board/BoardCanvas.test.tsx`:

```tsx
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EMPTY_BOARD } from "@/src/features/board/boardTypes";
import { BoardCanvas } from "@/src/features/board/BoardCanvas";

vi.mock("@xyflow/react", () => {
  const React = require("react");
  return {
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ReactFlow: ({ children, deleteKeyCode }: { children?: React.ReactNode; deleteKeyCode?: string | null }) => (
      <div data-testid="flow" data-delete-key={deleteKeyCode ?? ""}>
        {children}
      </div>
    ),
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
    MarkerType: { ArrowClosed: "arrow" },
    NodeResizer: () => null,
    Handle: () => null,
    Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
    BaseEdge: () => null,
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    getSmoothStepPath: () => ["M0 0", 0, 0, 0, 0],
    useReactFlow: () => ({
      screenToFlowPosition: () => ({ x: 100, y: 80 }),
      getNodes: () => [],
    }),
  };
});

const labels = {
  addTile: "+ Kafelek",
  addFrame: "+ Ramka",
  newTile: "Nowy kafelek",
  frameName: "Nazwa ramki",
  save: "Zapisz",
  cancel: "Anuluj",
  close: "Zamknij",
  tileTitle: "Tytuł",
  tileNote: "Notatka",
  delete: "Usuń",
};

describe("BoardCanvas", () => {
  it("adds a tile from the toolbar and asks for a frame name before adding a frame", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <BoardCanvas
        board={EMPTY_BOARD}
        userId="u1"
        lang="pl"
        labels={labels}
        dialogOpen={false}
        onChange={onChange}
        onTileAdded={vi.fn()}
        onOpenTile={vi.fn()}
        onDialogOpenChange={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "+ Kafelek" }));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].tiles[0].title).toBe("Nowy kafelek");
    await user.click(screen.getByRole("button", { name: "+ Ramka" }));
    expect(screen.getByRole("dialog", { name: "Nazwa ramki" })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox"), "Rdzeń");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(onChange.mock.calls.at(-1)[0].frames[0].title).toBe("Rdzeń");
  });

  it("clears the delete key while a dialog is open", () => {
    const { rerender } = render(
      <BoardCanvas
        board={EMPTY_BOARD}
        userId="u1"
        lang="pl"
        labels={labels}
        dialogOpen={false}
        onChange={vi.fn()}
        onTileAdded={vi.fn()}
        onOpenTile={vi.fn()}
        onDialogOpenChange={vi.fn()}
      />
    );
    expect(screen.getByTestId("flow")).toHaveAttribute("data-delete-key", "Backspace");
    rerender(
      <BoardCanvas
        board={EMPTY_BOARD}
        userId="u1"
        lang="pl"
        labels={labels}
        dialogOpen
        onChange={vi.fn()}
        onTileAdded={vi.fn()}
        onOpenTile={vi.fn()}
        onDialogOpenChange={vi.fn()}
      />
    );
    expect(screen.getByTestId("flow")).toHaveAttribute("data-delete-key", "");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/features/board/BoardCanvas.test.tsx`

Expected: FAIL, cannot find module `@/src/features/board/BoardCanvas`.

- [ ] **Step 3: Write minimal implementation**

`src/features/board/TileNode.tsx`:

```tsx
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
          <button type="button" aria-label="delete-tile" className="ml-2" onClick={() => data.onDelete(id)}>
            ×
          </button>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  );
}
```

`src/features/board/FrameNode.tsx`:

```tsx
import React from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import type { BoardFrame } from "@/src/features/board/boardTypes";

export type FrameNodeData = { frame: BoardFrame; onRename: (id: string) => void; onDelete: (id: string) => void };
export type FrameFlowNode = Node<FrameNodeData, "frame">;

export function FrameNode({ id, data, selected }: NodeProps<FrameFlowNode>) {
  return (
    <>
      <NodeResizer isVisible={selected} minWidth={200} minHeight={120} />
      <div className="h-full w-full rounded-xl border border-dashed border-[var(--border)]">
        <button type="button" className="px-2 py-1 text-xs font-bold" onDoubleClick={() => data.onRename(id)}>
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
```

`src/features/board/BoardEdge.tsx`:

```tsx
import React from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from "@xyflow/react";

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
```

`src/features/board/BoardCanvas.tsx`:

```tsx
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
import { readViewport, storeViewport, type BoardViewport } from "@/src/features/board/boardViewport";
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
  actions: { onDelete: (id: string) => void; onRename: (id: string) => void; onRemoveEdge: (id: string) => void }
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
  return frame
    ? { x: node.position.x + frame.x, y: node.position.y + frame.y }
    : node.position;
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
          onNodesDelete={(deleted) => onChange(applyDelete(board, deleted.map((node) => node.id)))}
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
```

`actions` w `useEffect` jest budowane przy każdym renderze. Zostaw je w ciele komponentu, jak wyżej. Jeśli linter zgłosi brakującą zależność, nie wkładaj `actions` do tablicy zależności: efekt ma reagować na `board`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/features/board/BoardCanvas.test.tsx tests/unit/features/board/boardActions.test.ts`

Expected: PASS. Test płótna: 2 testy. Akcje: 6 testów.

- [ ] **Step 5: Commit**

```bash
git add src/features/board/TileNode.tsx src/features/board/FrameNode.tsx src/features/board/BoardEdge.tsx src/features/board/BoardCanvas.tsx tests/unit/features/board/BoardCanvas.test.tsx
git commit -m "$(cat <<'EOF'
feat: add the board canvas

EOF
)"
```

---

### Task 11: Zakładka z odczytem i zapisem

**Files:**

- Create: `src/features/board/BoardTab.tsx`
- Test: `tests/unit/features/board/BoardTab.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/unit/features/board/BoardTab.test.tsx`:

```tsx
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardTab } from "@/src/features/board/BoardTab";

vi.mock("@/src/features/board/BoardCanvas", () => ({
  BoardCanvas: ({
    onChange,
  }: {
    onChange: (board: { tiles: unknown[]; frames: unknown[]; edges: unknown[] }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange({
          tiles: [{ id: "t", title: "A", note: "", x: 0, y: 0, w: 240, h: 120, frame: null }],
          frames: [],
          edges: [],
        })
      }
    >
      change
    </button>
  ),
}));

const labels = {
  canvas: "Płótno",
  list: "Lista",
  saveFailed: "Nie zapisano zmian",
  loadFailed: "Nie udało się wczytać tablicy",
  retry: "Ponów",
  outside: "Poza ramkami",
  tileTitle: "Tytuł",
  tileNote: "Notatka",
  close: "Zamknij",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("BoardTab", () => {
  it("shows a retry when the load fails and does not draw the canvas", async () => {
    const apiFetch = vi.fn().mockResolvedValue(jsonResponse({ error: "nope" }, 500));
    render(<BoardTab apiFetch={apiFetch} userId="u1" lang="pl" labels={labels} canvasLabels={{} as never} />);
    expect(await screen.findByText("Nie udało się wczytać tablicy")).toBeInTheDocument();
    expect(screen.queryByTestId("flow")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "change" })).not.toBeInTheDocument();
  });

  it("keeps the change on screen when the save fails", async () => {
    const user = userEvent.setup();
    const apiFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ tiles: [], frames: [], edges: [] }))
      .mockResolvedValueOnce(jsonResponse({ error: "nope" }, 500))
      .mockResolvedValueOnce(
        jsonResponse({
          tiles: [{ id: "t", title: "A", note: "", x: 0, y: 0, w: 240, h: 120, frame: null }],
          frames: [],
          edges: [],
        })
      );
    render(<BoardTab apiFetch={apiFetch} userId="u1" lang="pl" labels={labels} canvasLabels={{} as never} />);
    await user.click(await screen.findByRole("button", { name: "change" }));
    expect(await screen.findByText("Nie zapisano zmian")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "change" }));
    await waitFor(() => expect(screen.queryByText("Nie zapisano zmian")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "change" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/features/board/BoardTab.test.tsx`

Expected: FAIL, cannot find module `@/src/features/board/BoardTab`.

- [ ] **Step 3: Write minimal implementation**

`src/features/board/BoardTab.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from "react";
import type { Board } from "@/src/features/board/boardTypes";
import { EMPTY_BOARD } from "@/src/features/board/boardTypes";
import { updateTileText } from "@/src/features/board/boardActions";
import { BoardCanvas, type BoardCanvasLabels } from "@/src/features/board/BoardCanvas";
import { BoardList } from "@/src/features/board/BoardList";
import { TileDialog } from "@/src/features/board/TileDialog";

export interface BoardTabLabels {
  canvas: string;
  list: string;
  saveFailed: string;
  loadFailed: string;
  retry: string;
  outside: string;
  tileTitle: string;
  tileNote: string;
  close: string;
}

export function BoardTab({
  apiFetch,
  userId,
  lang,
  labels,
  canvasLabels,
}: {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  userId: string;
  lang: "pl" | "en";
  labels: BoardTabLabels;
  canvasLabels: BoardCanvasLabels;
}) {
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [view, setView] = useState<"canvas" | "list">("canvas");
  const [openTileId, setOpenTileId] = useState<string | null>(null);
  const [canvasDialog, setCanvasDialog] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    const response = await apiFetch("/api/board");
    if (!response.ok) {
      setLoaded(false);
      setLoadError(true);
      return;
    }
    setBoard((await response.json()) as Board);
    setLoaded(true);
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persist(next: Board) {
    setBoard(next);
    const response = await apiFetch("/api/board", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tiles: next.tiles, frames: next.frames, edges: next.edges }),
    });
    if (!response.ok) {
      setSaveError(true);
      return;
    }
    setBoard((await response.json()) as Board);
    setSaveError(false);
  }

  const openTile = board.tiles.find((tile) => tile.id === openTileId) ?? null;

  if (loadError || !loaded) {
    return (
      <div className="p-4">
        {loadError ? <p className="text-sm text-[var(--text)]">{labels.loadFailed}</p> : null}
        {loadError ? (
          <button type="button" onClick={() => void load()}>
            {labels.retry}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-2 p-2">
        <button type="button" onClick={() => setView("canvas")}>
          {labels.canvas}
        </button>
        <button type="button" onClick={() => setView("list")}>
          {labels.list}
        </button>
      </div>
      {saveError ? <p className="px-2 text-sm text-[var(--text)]">{labels.saveFailed}</p> : null}
      {view === "canvas" ? (
        <BoardCanvas
          board={board}
          userId={userId}
          lang={lang}
          labels={canvasLabels}
          dialogOpen={Boolean(openTile) || canvasDialog}
          onChange={(next) => void persist(next)}
          onDialogOpenChange={setCanvasDialog}
          onTileAdded={setOpenTileId}
          onOpenTile={setOpenTileId}
        />
      ) : (
        <BoardList board={board} outsideLabel={labels.outside} onOpen={setOpenTileId} />
      )}
      {openTile ? (
        <TileDialog
          tile={openTile}
          titleLabel={labels.tileTitle}
          noteLabel={labels.tileNote}
          closeLabel={labels.close}
          onSave={(patch) => {
            const next = updateTileText(board, openTile.id, patch.title, patch.note);
            setOpenTileId(null);
            if (next) void persist(next);
          }}
        />
      ) : null}
    </div>
  );
}
```

`BoardTabLabels` w tym pliku ma `tileTitle`, `tileNote` i `close`. Test z kroku 1 już je podaje. W tasku 12 przekaż je w `labels`, nie w `canvasLabels`.

Przy pierwszym renderze, zanim `GET` wróci, `loaded` jest fałszywe i płótno się nie rysuje. Test błędu od razu dostaje 500, więc widzi komunikat. Test zapisu czeka na przycisk `change`, który pojawia się po udanym `GET`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/features/board/BoardTab.test.tsx`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/board/BoardTab.tsx tests/unit/features/board/BoardTab.test.tsx
git commit -m "$(cat <<'EOF'
feat: load and save the board tab

EOF
)"
```

---

### Task 12: Wejście w menu

**Files:**

- Modify: `src/translations.ts` (oba języki, za `tabMindMaps`)
- Modify: `src/features/planowanie/PlanowanieSidebarContent.tsx`
- Modify: `src/features/planowanie/PlanowanieView.tsx`
- Modify: `src/features/home/HomeView.tsx` (tylko prop sidebara)
- Modify: `src/components/layout/MobileMoreDrawer.tsx`
- Test: `tests/unit/components/layout/MobileMoreDrawer.test.tsx` (dopisać jeden test)

- [ ] **Step 1: Write the failing test**

Dopisz do `tests/unit/components/layout/MobileMoreDrawer.test.tsx`:

```tsx
test("calls onSelectTab for the board", () => {
  const onSelectTab = vi.fn();
  render(
    <MobileMoreDrawer
      isOpen={true}
      onClose={vi.fn()}
      onLogout={vi.fn()}
      lang="pl"
      onSelectTab={onSelectTab}
    />
  );
  fireEvent.click(screen.getByText("Tablica"));
  expect(onSelectTab).toHaveBeenCalledWith("board");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/layout/MobileMoreDrawer.test.tsx`

Expected: FAIL, `Unable to find an element with the text: Tablica`.

- [ ] **Step 3: Write minimal implementation**

W obu obiektach `translations` dodaj klucze używane przez zakładkę: `tabBoard` („Board” / „Tablica”), `boardCanvas`, `boardList`, `boardAddTile`, `boardAddFrame`, `boardNewTile`, `boardFrameName`, `boardSave`, `boardCancel`, `boardClose`, `boardTileTitle`, `boardTileNote`, `boardDelete`, `boardOutside`, `boardSaveFailed`, `boardLoadFailed`, `boardRetry`. Angielskie odpowiedniki: Canvas, List, + Tile, + Frame, New tile, Frame name, Save, Cancel, Close, Title, Note, Delete, Outside frames, Changes were not saved, Could not load the board, Retry.

`PlanningTab` dostaje `"board"`. W `PlanowanieSidebarContent` nowy prop `tabBoard: string` i przycisk za mapami myśli, ikona `LayoutDashboard` z `lucide-react`, `onSelectTab("board")`.

W `PlanowanieView` i `HomeView` przekaż `tabBoard={(t.tabBoard as string) ?? "Tablica"}`. W gałęzi widoku, przed domyślnymi zadaniami:

```tsx
) : planningTab === "board" ? (
  <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg)] min-h-0">
    <BoardTab
      apiFetch={apiFetch}
      userId={user?.id ?? ""}
      lang={lang}
      labels={{
        canvas: t.boardCanvas as string,
        list: t.boardList as string,
        saveFailed: t.boardSaveFailed as string,
        loadFailed: t.boardLoadFailed as string,
        retry: t.boardRetry as string,
        outside: t.boardOutside as string,
        tileTitle: t.boardTileTitle as string,
        tileNote: t.boardTileNote as string,
        close: t.boardClose as string,
      }}
      canvasLabels={{
        addTile: t.boardAddTile as string,
        addFrame: t.boardAddFrame as string,
        newTile: t.boardNewTile as string,
        frameName: t.boardFrameName as string,
        save: t.boardSave as string,
        cancel: t.boardCancel as string,
        delete: t.boardDelete as string,
      }}
    />
  </div>
) : (
```

W `MobileMoreDrawer` dodaj pozycję `{ id: "board", labelPl: "Tablica", labelEn: "Board" }` za mapami myśli. Nie zmieniaj `MobileNav.tsx`. Nie dodawaj skrótu na stronie głównej.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/layout/MobileMoreDrawer.test.tsx tests/unit/features/home/HomeView.test.tsx tests/unit/features/board`

Expected: PASS. Istniejące testy strony głównej zostają zielone.

- [ ] **Step 5: Commit**

```bash
git add src/translations.ts src/features/planowanie/PlanowanieSidebarContent.tsx src/features/planowanie/PlanowanieView.tsx src/features/home/HomeView.tsx src/components/layout/MobileMoreDrawer.tsx tests/unit/components/layout/MobileMoreDrawer.test.tsx
git commit -m "$(cat <<'EOF'
feat: open the board from planning navigation

EOF
)"
```

---

### Task 13: Całość testów jednostkowych

- [ ] **Step 1: Run the board unit tests and the navigation test together**

Run: `npx vitest run tests/unit/features/board tests/unit/services/boardService.test.ts tests/unit/api/board.test.ts tests/unit/components/layout/MobileMoreDrawer.test.tsx`

Expected: PASS. Żaden test z tej listy nie jest pominięty.

- [ ] **Step 2: Run the whole unit suite**

Run: `npm run test:run`

Expected: PASS. Jeśli padnie próg coverage przez `boardDoc` w `lib/firestore-db.ts`, dopisz w `tests/unit/services/boardService.test.ts` jeden test bez mocka `boardDoc`, który mockuje `getFirestore` tak, jak robi to najbliższy test `lib/`, i sprawdza, że ścieżka dokumentu to `users/u1/board/main`. Nie obniżaj progów.

- [ ] **Step 3: Commit only if step 2 changed a file**

Jeśli krok 2 wymusił dopisanie testu `boardDoc`, commit:

```bash
git add tests/unit/services/boardService.test.ts
git commit -m "$(cat <<'EOF'
test: cover the board document path

EOF
)"
```

Jeśli suite przeszedł bez zmian, nie rób pustego commita.
