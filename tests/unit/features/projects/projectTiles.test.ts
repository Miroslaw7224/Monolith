import { describe, expect, it } from "vitest";
import type { ProjectDetailDto, ProjectSummaryDto } from "@/contexts/bc_projects/schemas";
import { buildProjectTiles, isPaused, needsDecision } from "@/src/features/projects/projectTiles";

function p(partial: Partial<ProjectSummaryDto> & Pick<ProjectSummaryDto, "id">): ProjectSummaryDto {
  return {
    name: partial.id,
    status: "active",
    priority: "P2",
    localPath: `/tmp/${partial.id}`,
    owner: "personal",
    freshness: "fresh",
    ...partial,
  };
}

function d(partial: Partial<ProjectDetailDto> & Pick<ProjectDetailDto, "id">): ProjectDetailDto {
  return {
    ...p(partial),
    tasks: [],
    board: { blockers: [], now: [], next: [], icebox: [], version: null },
    bugs: [],
    whereIStopped: null,
    state: null,
    stateVersion: null,
    devlog: [],
    ...partial,
  };
}

describe("buildProjectTiles", () => {
  it("aktywne projekty: liczy status active (bez wielkości liter) i rozbija po typie", () => {
    const tiles = buildProjectTiles(
      [
        p({ id: "a", type: "wlasny" }),
        p({ id: "b", status: "Active", type: "wlasny" }),
        p({ id: "c", type: "biblioteka" }),
        p({ id: "d", status: "done", type: "wlasny" }),
        p({ id: "e" }),
      ],
      null
    );
    expect(tiles[0]).toMatchObject({
      id: "active",
      value: "4",
      meta: "2 własne · 1 biblioteka · 1 bez typu",
    });
  });

  it("wymaga decyzji: liczba stale i nazwy (maks. 2 + reszta)", () => {
    const tiles = buildProjectTiles(
      [
        p({ id: "a", freshness: "stale" }),
        p({ id: "b", freshness: "stale" }),
        p({ id: "c", freshness: "stale" }),
        p({ id: "d" }),
      ],
      null
    );
    expect(tiles[2]).toMatchObject({
      id: "stale",
      value: "3",
      meta: "a, b i 1 więcej",
      tone: "danger",
    });
  });

  it("brak stale: meta o świeżości, bez tonu danger", () => {
    const tiles = buildProjectTiles([p({ id: "a" })], null);
    expect(tiles[2]).toMatchObject({ value: "0", meta: "wszystko świeże" });
    expect(tiles[2].tone).toBeUndefined();
  });

  it("bez wybranego projektu: kafle bugów i paczki pokazują kreskę", () => {
    const tiles = buildProjectTiles([p({ id: "a" })], null);
    expect(tiles[1]).toMatchObject({ id: "bugs", value: "—", meta: "wybierz projekt" });
    expect(tiles[3]).toMatchObject({ id: "pack", value: "—", meta: "wybierz projekt" });
  });

  it("uśpione (paused) i zakończone nie wymagają decyzji", () => {
    const tiles = buildProjectTiles(
      [
        p({ id: "a", freshness: "stale" }),
        p({ id: "b", status: "paused", freshness: "stale" }),
        p({ id: "c", status: "done", freshness: "stale" }),
      ],
      null
    );
    expect(tiles[2]).toMatchObject({ value: "1", meta: "a" });
  });

  it("needsDecision i isPaused", () => {
    expect(needsDecision({ status: "active", freshness: "stale" })).toBe(true);
    expect(needsDecision({ status: "Paused", freshness: "stale" })).toBe(false);
    expect(needsDecision({ status: "active", freshness: "fresh" })).toBe(false);
    expect(isPaused({ status: "PAUSED" })).toBe(true);
    expect(isPaused({ status: "active" })).toBe(false);
  });

  it("wybrany projekt: aktywne bugi (bez Zamknięte) i zapełnienie Teraz", () => {
    const detail = d({
      id: "a",
      bugs: [
        { id: "B-1", title: "x", section: "Aktywne" },
        { id: "B-2", title: "y", section: "Zamknięte" },
      ],
      board: {
        blockers: [],
        now: [{ text: "t", done: false }],
        next: [],
        icebox: [],
        version: null,
      },
    });
    const tiles = buildProjectTiles([p({ id: "a" })], detail);
    expect(tiles[1]).toMatchObject({ value: "1", meta: "w projekcie a" });
  });

  it("kafel paczki: ładowanie, błąd, tokeny i procent budżetu", () => {
    const detail = d({ id: "a" });
    const list = [p({ id: "a" })];
    expect(buildProjectTiles(list, detail, { status: "loading" })[3]).toMatchObject({
      id: "pack",
      value: "—",
      meta: "składam paczkę…",
    });
    expect(buildProjectTiles(list, detail, { status: "error", error: "x" })[3]).toMatchObject({
      value: "—",
      meta: "paczka niedostępna",
    });
    const pack = { markdown: "", approxTokens: 3850, truncated: false, warnings: [] };
    expect(buildProjectTiles(list, detail, { status: "ready", pack })[3]).toMatchObject({
      value: "3 850 tok",
      meta: "96% budżetu 4 000 tokenów",
    });
    expect(
      buildProjectTiles(list, detail, { status: "ready", pack: { ...pack, truncated: true } })[3]
        .meta
    ).toBe("96% budżetu 4 000 tokenów · skrócona");
  });
});
