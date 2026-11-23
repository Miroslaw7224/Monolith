// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { UserTag } from "@/contexts/bc_tags/models";
import { resolveTagNames, resolveTags } from "@/contexts/bc_tags/services";
import { formatYamlList } from "@/lib/nexus/yaml-lists";
import { readList } from "@/lib/nexus/yaml-store";
import { setupTempVault } from "../../helpers/tempVault";

const vault = setupTempVault();
const FILE = "Resources/tags.yaml";

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
  /** Słownik z DICT zapisany w pliku tak, jak robi to repozytorium. */
  const seedDict = () =>
    vault.write(
      FILE,
      formatYamlList(
        "tags",
        DICT.map(({ id, tag, title, color, aliases }) => ({
          id,
          tag,
          title,
          ...(color ? { color } : {}),
          ...(aliases ? { aliases } : {}),
        }))
      )
    );
  const storedTags = () => readList(FILE, "tags").map((r) => r.tag);

  it("dla pustej listy nic nie tworzy", async () => {
    expect(await resolveTags([])).toEqual([]);
    expect(vault.read(FILE)).toBeNull();
  });
  it("znane tagi: bez dopisywania do słownika", async () => {
    seedDict();
    const before = vault.read(FILE);

    expect(await resolveTags(["agent ai", "AI"])).toEqual(["Agenci AI", "AI"]);

    expect(vault.read(FILE)).toBe(before);
  });
  it("nieznany tag dopisuje do słownika raz, bez koloru, z title = nazwa", async () => {
    seedDict();

    expect(await resolveTags(["Nowy", "nowy"])).toEqual(["Nowy"]);

    expect(storedTags()).toEqual(["Agenci AI", "Praca własna", "AI", "Nowy"]);
    const added = readList(FILE, "tags").at(-1)!;
    expect(added).toMatchObject({ tag: "Nowy", title: "Nowy" });
    expect("color" in added).toBe(false);
  });
  it("tekst zamiast listy (np. PUT kalendarza) traktuje jak jeden tag, nie rozbija na znaki", async () => {
    seedDict();

    expect(await resolveTags("abc")).toEqual(["abc"]);

    expect(storedTags()).toEqual(["Agenci AI", "Praca własna", "AI", "abc"]);
  });
  it("wartość spoza listy i tekstu (liczba, obiekt) daje pustą listę i nic nie dopisuje", async () => {
    seedDict();
    const before = vault.read(FILE);

    expect(await resolveTags(5)).toEqual([]);
    expect(await resolveTags({})).toEqual([]);

    expect(vault.read(FILE)).toBe(before);
  });
});
