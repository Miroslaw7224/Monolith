import { describe, it, expect, beforeEach, vi } from "vitest";
import type { UserTag } from "@/contexts/bc_tags/models";
import { resolveTagNames, resolveTags } from "@/contexts/bc_tags/services";

const mockGetUserTags = vi.hoisted(() => vi.fn());
const mockCreateUserTag = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_tags/repositories", () => ({
  getUserTags: (...a: unknown[]) => mockGetUserTags(...a),
  createUserTag: (...a: unknown[]) => mockCreateUserTag(...a),
  updateUserTag: vi.fn(),
  deleteUserTag: vi.fn(),
}));

const DICT: UserTag[] = [
  { id: "t1", tag: "Agenci AI", title: "Agenci AI", aliases: ["Agent AI"] },
  {
    id: "t2",
    tag: "Praca własna",
    title: "Moje projekty",
    color: "#ff8800",
    aliases: ["Projekty", "moje projekty"],
  },
  { id: "t3", tag: "AI", title: "AI" },
];

describe("resolveTagNames", () => {
  it("zamienia alias na nazwę kanoniczną bez względu na wielkość liter", () => {
    expect(resolveTagNames(["agent ai"], DICT)).toEqual({ tags: ["Agenci AI"], missing: [] });
  });
  it("sprowadza nazwę kanoniczną do zapisu ze słownika i usuwa duplikaty", () => {
    expect(resolveTagNames(["ai", " AI ", "Ai"], DICT)).toEqual({ tags: ["AI"], missing: [] });
  });
  it("kilka aliasów tego samego tagu daje jeden tag", () => {
    expect(resolveTagNames(["Projekty", "moje projekty", "Praca własna"], DICT).tags).toEqual([
      "Praca własna",
    ]);
  });
  it("nieznane tagi zachowują kolejność, trafiają do missing raz", () => {
    expect(resolveTagNames(["Nowy", "nowy", "Inny"], DICT)).toEqual({
      tags: ["Nowy", "Inny"],
      missing: ["Nowy", "Inny"],
    });
  });
  it("pomija puste i nie-teksty, zdejmuje wiodące #", () => {
    expect(resolveTagNames(["", "  ", 5, null, "#Nowy"], DICT)).toEqual({
      tags: ["Nowy"],
      missing: ["Nowy"],
    });
  });
  it("nazwa kanoniczna ma pierwszeństwo przed aliasem innego tagu", () => {
    const dict: UserTag[] = [
      { id: "a", tag: "A", title: "A", aliases: ["B"] },
      { id: "b", tag: "B", title: "B" },
    ];
    expect(resolveTagNames(["b"], dict).tags).toEqual(["B"]);
  });
  it("zwraca puste wyniki dla pustego wejścia", () => {
    expect(resolveTagNames([], DICT)).toEqual({ tags: [], missing: [] });
  });
});

describe("resolveTags", () => {
  beforeEach(() => {
    mockGetUserTags.mockReset();
    mockCreateUserTag.mockReset();
    mockGetUserTags.mockResolvedValue(DICT);
    mockCreateUserTag.mockResolvedValue({ id: "new", tag: "x", title: "x" });
  });

  it("dla pustej listy nie czyta słownika", async () => {
    expect(await resolveTags([])).toEqual([]);
    expect(mockGetUserTags).not.toHaveBeenCalled();
  });
  it("znane tagi: bez dopisywania do słownika", async () => {
    expect(await resolveTags(["agent ai", "AI"])).toEqual(["Agenci AI", "AI"]);
    expect(mockCreateUserTag).not.toHaveBeenCalled();
  });
  it("nieznany tag dopisuje do słownika raz, bez koloru, z title = nazwa", async () => {
    expect(await resolveTags(["Nowy", "nowy"])).toEqual(["Nowy"]);
    expect(mockCreateUserTag).toHaveBeenCalledTimes(1);
    expect(mockCreateUserTag).toHaveBeenCalledWith({ tag: "Nowy", title: "Nowy" });
  });
  it("tekst zamiast listy (np. PUT kalendarza) traktuje jak jeden tag, nie rozbija na znaki", async () => {
    expect(await resolveTags("abc" as unknown as string[])).toEqual(["abc"]);
    expect(mockCreateUserTag).toHaveBeenCalledTimes(1);
    expect(mockCreateUserTag).toHaveBeenCalledWith({ tag: "abc", title: "abc" });
  });
  it("wartość spoza listy i tekstu (liczba, obiekt) daje pustą listę i nic nie dopisuje", async () => {
    expect(await resolveTags(5 as unknown as string[])).toEqual([]);
    expect(await resolveTags({} as unknown as string[])).toEqual([]);
    expect(mockCreateUserTag).not.toHaveBeenCalled();
  });
  it("błąd zapisu słownika przerywa operację", async () => {
    mockCreateUserTag.mockRejectedValue(new Error("409"));
    await expect(resolveTags(["Nowy"])).rejects.toThrow("409");
  });
});
