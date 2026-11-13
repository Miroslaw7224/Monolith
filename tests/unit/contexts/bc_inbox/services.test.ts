// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError, NotFoundError } from "@/lib/errors";

const mockRead = vi.hoisted(() => vi.fn());
const mockAppend = vi.hoisted(() => vi.fn());
const mockResolve = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/bc_inbox/repositories", () => ({
  readOpenItems: mockRead,
  appendItem: mockAppend,
  resolveItem: mockResolve,
}));

import { addItem, countOpen, detectType, listItems, resolve } from "@/contexts/bc_inbox/services";

const NOW = new Date(2026, 10, 13, 21, 5);

beforeEach(() => {
  vi.resetAllMocks();
  mockAppend.mockResolvedValue(undefined);
});

describe("detectType", () => {
  it.each([
    ["https://vitest.dev/guide", "link", "https://vitest.dev/guide"],
    ["  http://x.pl  ", "link", "http://x.pl"],
    ["bug: pusta lista", "bug", "pusta lista"],
    ["Bug pusta lista", "bug", "pusta lista"],
    ["snippet: const a = 1", "snippet", "const a = 1"],
    ["kod: x[0]", "snippet", "x[0]"],
    ["Radar blokad w Mapie", "myśl", "Radar blokad w Mapie"],
    ["bugatti to auto", "myśl", "bugatti to auto"],
    ["zobacz https://x.pl", "myśl", "zobacz https://x.pl"],
  ])("%s → %s", (input, type, text) => {
    expect(detectType(input)).toEqual({ type, text });
  });
});

describe("addItem", () => {
  it("zapisuje wpis z typem i lokalnym znacznikiem czasu", async () => {
    const item = await addItem("bug: pusta lista", NOW);
    expect(mockAppend).toHaveBeenCalledWith({
      text: "pusta lista",
      type: "bug",
      at: "2026-11-13T21:05",
    });
    expect(item).toMatchObject({ text: "pusta lista", type: "bug", at: "2026-11-13T21:05" });
  });

  it("zamienia nowe linie na spacje i przycina", async () => {
    await addItem("  a\n  b \r\n c ", NOW);
    expect(mockAppend.mock.calls[0][0].text).toBe("a b c");
  });

  it("pusty tekst, sam prefiks i tekst > 500 znaków to DomainError bez zapisu", async () => {
    await expect(addItem("  ", NOW)).rejects.toBeInstanceOf(DomainError);
    await expect(addItem("bug:", NOW)).rejects.toBeInstanceOf(DomainError);
    await expect(addItem("a".repeat(501), NOW)).rejects.toBeInstanceOf(DomainError);
    expect(mockAppend).not.toHaveBeenCalled();
  });
});

describe("listItems / countOpen / resolve", () => {
  const items = [
    { id: "1", text: "a", type: "myśl", at: null },
    { id: "2", text: "b", type: "link", at: null },
  ];

  it("najnowsze (z końca pliku) pierwsze; liczba otwartych", () => {
    mockRead.mockReturnValue(items);
    expect(listItems().map((i) => i.id)).toEqual(["2", "1"]);
    expect(countOpen()).toBe(2);
  });

  it("resolve: ok albo NotFoundError", async () => {
    mockResolve.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(resolve("1")).resolves.toBeUndefined();
    await expect(resolve("x")).rejects.toBeInstanceOf(NotFoundError);
  });
});
