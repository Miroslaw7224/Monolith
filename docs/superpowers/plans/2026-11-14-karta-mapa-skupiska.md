# Karta Mapa: skupiska notatek, połączenia, zoom i dopasowanie — plan wykonania

> **Dla agentów wykonujących:** WYMAGANY PODSKILL: `superpowers:subagent-driven-development` (zalecany) albo `superpowers:executing-plans`. Kroki mają checkboxy (`- [ ]`).

**Cel:** zamienić globus „7 projektów + 3 kontynenty” na globus ok. 255 punktów-notatek zbitych w ok. 21 skupisk, z większą liczbą połączeń, zoomem `−`/`+` i dopasowaniem do okna.

**Architektura:** `bc_map` zwraca węzły-notatki, skupiska, krawędzie notatka–notatka oraz zagregowane krawędzie skupisk (czyste funkcje w `services`). UI układa skupiska na kuli (`globeMath`), rysuje je na canvasie 2D, a zoom i rozmiar płótna liczy względem `fitRadius`.

**Stack:** Next.js 14, TypeScript, zod, vitest + Testing Library, canvas 2D (bez nowych zależności).

**Spec:** `docs/superpowers/specs/2026-11-14-karta-mapa-skupiska-design.md` (decyzje D14–D20). Zastępuje D4, D5 i układ ze specu etapu 1.

## Zasady wykonania (CLAUDE.md)

- Plan podaje sygnatury, reguły i konkretne przypadki testowe; implementację piszesz w kroku wykonania, w TDD (czerwony → zielony).
- **`npx tsc --noEmit` ma sens dopiero po zadaniu 7**: typy DTO zmieniają się przez cały stos, więc w zadaniach 1–6 uruchamiaj tylko wskazane pliki testów. Commity pośrednie nie muszą przechodzić `tsc`.
- Testy, lint, typecheck i build (pełne przebiegi) → `cursor` (zadanie 8). Małe testy z jednego pliku odpalaj sam, z przyciętym wynikiem (`2>&1 | tail -30`).
- Test architektury (`tests/unit/architecture.static.test.ts`) **nie jest zmieniany**; gdyby pękł, naprawiasz kod. Gdyby zmiana testu była jednak konieczna, idzie osobnym commitem przed kodem.
- Commity na gałęzi `feat/karta-mapa`, bez pusha. Każdy commit kończy trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (drugi `-m`).

## Pliki

| Plik                                          | Zmiana                                                                                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contexts/bc_map/models.ts`                   | nowe typy: `MapCluster`, `MapNode` (notatka), `MapEdge`, `MapClusterEdge`, `RawNote`, `MapSources`                                                                   |
| `contexts/bc_map/repositories.ts`             | odczyt notatek: tytuł, kategoria, `projects`, wikilinki; `extractWikiLinks`, `primaryCategory`                                                                       |
| `contexts/bc_map/services.ts`                 | `resolveLink`, `buildClusters`, `aggregateEdges`, nowy `composeGraph`; agenci bez zmian                                                                              |
| `contexts/bc_map/schemas.ts`                  | DTO: `clusters`, `nodes`, `edges`, `clusterEdges`                                                                                                                    |
| `src/features/map/globeMath.ts`               | `layoutClusters`, `layoutPoints`, `capPoint`, `capOutline`, `fitRadius`, `clampZoom`, `stepZoom`, zoom w `project`, min. promień w `hitTest`; usunięte `layoutNodes` |
| `src/features/map/selection.ts` (nowy)        | `MapSelection`, `noteNeighbors`                                                                                                                                      |
| `src/features/map/GlobeControls.tsx` (nowy)   | przyciski `−`, `+`, „Dopasuj do okna”, wskaźnik zoomu                                                                                                                |
| `src/features/map/MapClusterPanel.tsx` (nowy) | panel zaznaczenia: lista notatek skupiska / sąsiedzi notatki                                                                                                         |
| `src/features/map/MapNodeList.tsx`            | lista skupisk zamiast węzłów                                                                                                                                         |
| `src/features/map/mapTiles.ts`                | tylko tekst meta kafla „Zależności”                                                                                                                                  |
| `src/features/map/Globe.tsx`                  | przepisany: płaty, punkty, łuki, zoom, kółko, szczypanie, klawisze                                                                                                   |
| `src/features/map/MapView.tsx`, `map.css`     | zaznaczenie skupisko/notatka, panel, legenda, płótno wypełniające okno                                                                                               |
| `tests/unit/...`                              | patrz zadania                                                                                                                                                        |

---

### Zadanie 1: modele i odczyt notatek (`models.ts`, `repositories.ts`)

**Pliki:** zmiana `contexts/bc_map/models.ts`, `contexts/bc_map/repositories.ts`; test `tests/unit/contexts/bc_map/repositories.test.ts`.

**Typy (zastępują stare `MapNode`, `MapEdge`, `MapSources`, `CONTINENT_IDS`; `Owner`, `Agent`, `ProjectRef`, `MapTiles` zostają):**

```ts
export type ClusterGroup = "projects" | "knowledge" | "ai2030" | "skills";
export type MapCluster = {
  id: string;
  label: string;
  group: ClusterGroup;
  size: number;
  projectId?: string;
  owner?: Owner;
  soon?: boolean;
};
/** Notatka = punkt na globusie. `id` to ścieżka względem Vault bez `.md`. */
export type MapNode = { id: string; label: string; cluster: string; links: number };
/** `link`: notatka–notatka (para nieskierowana, `from` < `to`); `project`: notatka Wiedzy → id projektu. */
export type MapEdge = { from: string; to: string; weight: number; type: "link" | "project" };
export type MapClusterEdge = { from: string; to: string; weight: number };
export type MapGraph = {
  clusters: MapCluster[];
  nodes: MapNode[];
  edges: MapEdge[];
  clusterEdges: MapClusterEdge[];
  tiles: MapTiles;
  warnings: string[];
};
export type RawNote = {
  path: string; // względem Vault, bez .md
  area: "knowledge" | "ai2030" | "project";
  projectId?: string; // tylko area "project"
  title: string;
  category?: string; // tylko Wiedza
  projects: string[]; // tylko Wiedza (pole `projects:`)
  links: string[]; // cele wikilinków z treści, z duplikatami
};
export type MapSources = { sharedSections: string[][]; notes: RawNote[]; warnings: string[] };
export const SKILLS_CLUSTER_ID = "skille";
export const AI2030_CLUSTER_ID = "ai-2030";
export const OTHER_CATEGORY = "inne";
export const MIN_CATEGORY_NOTES = 3;
export const MAX_CLUSTER_EDGES = 40;
export const knowledgeClusterId = (category: string): string => `knowledge:${category}`;
```

**Sygnatury i reguły `repositories.ts`:**

- `parseSharedSections`, `parseNoteProjects`: bez zmian.
- `extractWikiLinks(text: string): string[]`: usuń bloki kodu ogrodzone `` (regex `/``[\s\S]\*?```/g`), potem dla każdego `[[…]]` (`/\[\[([^\]]+)\]\]/g`) weź tekst przed pierwszym `|`, potem przed pierwszym `#`, `trim`; puste pomiń. Kolejność i duplikaty zachowane.
- `primaryCategory(meta: Frontmatter): string | undefined`: `categories` jako tablica albo tekst rozdzielony przecinkami; pierwszy niepusty element po `trim().toLowerCase()`; inaczej `undefined`.
- `readMapSources(): MapSources`:
  - `tech-stack-wspolny.md` jak dotąd (brak pliku → ostrzeżenie `Brak tech-stack-wspolny.md: bez krawędzi projekt–projekt`).
  - Przejdź `listVaultFilesRecursive` dla `Knowledge` (area `knowledge`), `AI-2030` (`ai2030`), `Projects` (`project`).
  - Pomiń plik, gdy nazwa pliku zaczyna się od `_` albo któryś segment ścieżki to `attachments`.
  - Dla `Projects/<id>/…` `projectId` = drugi segment; ścieżki o mniej niż 3 segmentach (np. `Projects/stray.md`) pomiń.
  - Treść przez `readVaultFile` + `parseFrontmatter` (brak frontmattera: `meta = {}`, treść całością). `title` = `meta.name` albo `meta.title` (niepusty tekst), inaczej nazwa pliku bez `.md`. `projects` = `parseNoteProjects(meta)` tylko dla Wiedzy, inaczej `[]`.
  - Błąd odczytu pliku: ostrzeżenie `Nie można odczytać notatki ${rel}` i pominięcie.
  - Notatki posortowane po `path` porównaniem punktów kodowych (`a < b`).
- `readTerminals`: bez zmian.

- [ ] **Krok 1: Napisz testy (czerwone)** w `tests/unit/contexts/bc_map/repositories.test.ts`. Zostaw istniejące `describe("parseSharedSections")` i `describe("parseNoteProjects")`, zaktualizuj import (`extractWikiLinks`, `primaryCategory`), a blok `describe("readMapSources")` zastąp:

````ts
describe("extractWikiLinks", () => {
  it("obcina alias i kotwicę, pomija puste cele i bloki kodu, zachowuje duplikaty", () => {
    const text = "[[a]] [[b|alias]] [[c#h]] [[d#h|x]] [[ ]]\n```\n[[w-kodzie]]\n```\n[[e]] [[a]]";
    expect(extractWikiLinks(text)).toEqual(["a", "b", "c", "d", "e", "a"]);
  });
});

describe("primaryCategory", () => {
  it("bierze pierwszą wartość listy, małe litery, trim", () => {
    expect(primaryCategory({ categories: [" Dev-Tools ", "ai"] })).toBe("dev-tools");
  });
  it("obsługuje tekst z przecinkami; brak i pusta lista dają undefined", () => {
    expect(primaryCategory({ categories: "AI, x" })).toBe("ai");
    expect(primaryCategory({ categories: [] })).toBeUndefined();
    expect(primaryCategory({})).toBeUndefined();
  });
});

describe("readMapSources", () => {
  const vault = useTempVault();

  it("czyta notatki trzech obszarów; pomija _*, attachments/, Work/ i pliki bez katalogu projektu", () => {
    vault.write("tech-stack-wspolny.md", TECH_STACK);
    vault.write(
      "Knowledge/a.md",
      "---\nname: A\ncategories: [Dev-Tools, ai]\nprojects: [nexus, monolith]\n---\nZob. [[b]], [[Projects/nexus/nexus|NEXUS]] i [[b#kotwica]].\n```\n[[w-kodzie]]\n```\n"
    );
    vault.write("Knowledge/sub/b.md", "---\nname: B\nprojects: []\n---\n[[a]]");
    vault.write("Knowledge/sub/c.md", "bez frontmattera [[a]]");
    vault.write("Knowledge/_index.md", "idx");
    vault.write("Knowledge/sql/attachments/x.md", "att");
    vault.write("AI-2030/x.md", "x");
    vault.write("Projects/nexus/index.md", "i");
    vault.write("Projects/stray.md", "s");
    vault.write("Projects/Work/secret.md", "s");

    const sources = readMapSources();
    expect(sources.notes.map((n) => n.path)).toEqual([
      "AI-2030/x",
      "Knowledge/a",
      "Knowledge/sub/b",
      "Knowledge/sub/c",
      "Projects/nexus/index",
    ]);
    const byPath = Object.fromEntries(sources.notes.map((n) => [n.path, n]));
    expect(byPath["Knowledge/a"]).toMatchObject({
      area: "knowledge",
      title: "A",
      category: "dev-tools",
      projects: ["nexus", "monolith"],
      links: ["b", "Projects/nexus/nexus", "b"],
    });
    expect(byPath["Knowledge/sub/c"]).toMatchObject({ title: "c", links: ["a"], projects: [] });
    expect(byPath["Knowledge/sub/c"].category).toBeUndefined();
    expect(byPath["AI-2030/x"]).toMatchObject({ area: "ai2030", title: "x" });
    expect(byPath["Projects/nexus/index"]).toMatchObject({
      area: "project",
      projectId: "nexus",
      title: "index",
      projects: [],
    });
    expect(sources.sharedSections).toHaveLength(2);
    expect(sources.warnings).toEqual([]);
  });

  it("brak tech-stack-wspolny.md daje ostrzeżenie, nie wyjątek", () => {
    const sources = readMapSources();
    expect(sources.sharedSections).toEqual([]);
    expect(sources.notes).toEqual([]);
    expect(sources.warnings.join(" ")).toMatch(/tech-stack-wspolny\.md/);
  });
});
````

- [ ] **Krok 2: Uruchom — czerwone:** `npx vitest run tests/unit/contexts/bc_map/repositories.test.ts 2>&1 | tail -30` → FAIL (`extractWikiLinks is not a function` itd.).
- [ ] **Krok 3: Zaimplementuj** `models.ts` (typy wyżej) i `repositories.ts` (reguły wyżej).
- [ ] **Krok 4: Uruchom — zielone:** ta sama komenda → PASS.
- [ ] **Krok 5: Commit**

```bash
git add contexts/bc_map/models.ts contexts/bc_map/repositories.ts tests/unit/contexts/bc_map/repositories.test.ts
git commit -m "feat(mapa): odczyt notatek z wikilinkami, kategorią i projektami" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Zadanie 2: skupiska, linki i agregacja (`services.ts`)

**Pliki:** zmiana `contexts/bc_map/services.ts`; test `tests/unit/contexts/bc_map/services.test.ts` (zastąp blok `describe("composeGraph")`, bloki `resolveAgentProject`/`toAgents` zostają bez zmian).

**Sygnatury i reguły:**

```ts
export type LinkResolution =
  | { kind: "note"; id: string }
  | { kind: "ignored" }
  | { kind: "missing" };
export function resolveLink(target: string, notes: RawNote[]): LinkResolution;
export function buildClusters(
  projects: ProjectRef[],
  notes: RawNote[]
): { clusters: MapCluster[]; noteCluster: Map<string, string>; unknownProjects: string[] };
export type ClusterPair = { a: string; b: string; weight: number };
export function aggregateEdges(
  pairs: ClusterPair[],
  limit: number
): { edges: MapClusterEdge[]; total: number };
export function composeGraph(projects: ProjectRef[], sources: MapSources): MapGraph;
```

- **`resolveLink`** (D18): `t = target.trim().replace(/\.md$/i, "").replace(/^\/+/, "")`; ostatni segment zaczyna się od `_` → `{kind:"ignored"}`. Kandydaci to notatki, których `path` (małe litery) równa się `t` (małe litery) albo kończy się na `"/" + t`. Pierwszeństwo: area `knowledge` < `project` < `ai2030`, potem `path` rosnąco. Brak kandydatów → `{kind:"missing"}`.
- **`buildClusters`** (D14, D15):
  - Klastry projektów: po jednym na każdy projekt z rejestru, posortowane po `id`: `{ id: p.id, label: p.name, group: "projects", size: liczba notatek z projectId == id, projectId: p.id, owner: p.owner }` (także z `size: 0`).
  - Notatki `project` z `projectId` spoza rejestru: pomijane, ich unikalne id (posortowane) wracają w `unknownProjects`.
  - Wiedza: kategoria notatki = `category ?? "inne"`; kategoria z mniej niż `MIN_CATEGORY_NOTES` (3) notatkami (poza samym „inne”) → „inne”. Skupisko `{ id: knowledgeClusterId(cat), label: cat, group: "knowledge", size }`; kolejność: po liczności malejąco, remis po `id`, **„inne” zawsze ostatnie**; „inne” tylko gdy `size > 0`.
  - AI-2030: `{ id: "ai-2030", label: "AI-2030", group: "ai2030", size }` (zawsze).
  - Skille: `{ id: "skille", label: "Skille", group: "skills", size: 0, soon: true }` (zawsze).
  - Kolejność końcowa: projekty, Wiedza, AI-2030, Skille. `noteCluster`: `path → id skupiska` dla przypisanych notatek.
- **`aggregateEdges`**: pomija `a === b`; łączy pary nieuporządkowane (`from` = mniejsze `id` porównaniem `<`, `to` = większe), sumuje wagi; sortuje po wadze malejąco, potem `from`, `to`; `total` = liczba par przed obcięciem; zwraca pierwsze `limit`.
- **`composeGraph`** (D16, D19):
  1. `buildClusters`; warning dla `unknownProjects`: `Mapa: notatki w nieznanych projektach (pominięte): <id, id>`.
  2. Przypisane notatki → `MapNode { id: path, label: title, cluster, links: 0 }`.
  3. Dla każdej notatki i każdego jej linku: `resolveLink` względem **przypisanych** notatek; `missing` liczone; `ignored` i link do samej siebie pomijane; para `(min, max)` ścieżek → waga +1 (typ `link`). Po pętli, gdy `missing > 0`: warning `Mapa: nierozwiązane linki: <n> (pominięte)`.
  4. Dla notatek Wiedzy: każdy unikalny `projects[i]` znany w rejestrze → krawędź `{ from: path, to: projectId, weight: 1, type: "project" }`; nieznany → jak dotąd warning `Mapa: nieznany projekt „<id>” w tech-stack-wspolny.md lub notatkach Wiedzy (pominięty)` (raz na id, posortowane).
  5. `links` węzła = suma wag krawędzi `link` przy nim + liczba jego krawędzi `project`.
  6. Pary do agregacji: każda krawędź `link` (skupisko obu końców), każda `project` (skupisko notatki ↔ id projektu, które jest id skupiska), każda sekcja `sharedSections` jak dotąd (pary znanych projektów po 1). Nieznane id w sekcjach: warning jak w pkt 4.
  7. `aggregateEdges(pairs, MAX_CLUSTER_EDGES)` → `clusterEdges`; `tiles.dependencies = total`.
  8. `tiles.neurons`: `total` = liczba węzłów; `knowledge`, `ai2030`, `projects` = liczba węzłów w skupiskach danej grupy.
  9. `nodes` posortowane po `id`; `edges` po `from`, `to`, `type`; ostrzeżenia z `sources.warnings` na początku.
- `getGraph()`: bez zmian (woła `composeGraph(refs, readMapSources())`).

- [ ] **Krok 1: Napisz testy (czerwone).** W `tests/unit/contexts/bc_map/services.test.ts` zmień importy (`aggregateEdges`, `buildClusters`, `composeGraph`, `resolveLink`, `resolveAgentProject`, `toAgents`; typy `MapSources`, `ProjectRef`, `RawNote`) i zastąp blok `describe("composeGraph")`:

```ts
const note = (path: string, o: Partial<RawNote> = {}): RawNote => ({
  path,
  area: "knowledge",
  title: path.split("/").pop() ?? path,
  projects: [],
  links: [],
  ...o,
});

describe("resolveLink", () => {
  const notes = [
    note("Knowledge/sub/b"),
    note("Knowledge/a"),
    note("Projects/monolith/monolith", { area: "project", projectId: "monolith" }),
    note("AI-2030/a", { area: "ai2030" }),
  ];
  it("sam basename, wiele trafień: Wiedza przed AI-2030", () => {
    expect(resolveLink("a", notes)).toEqual({ kind: "note", id: "Knowledge/a" });
  });
  it("częściowa i pełna ścieżka, wielkość liter i .md", () => {
    expect(resolveLink("sub/b", notes)).toEqual({ kind: "note", id: "Knowledge/sub/b" });
    expect(resolveLink("B.md", notes)).toEqual({ kind: "note", id: "Knowledge/sub/b" });
    expect(resolveLink("Projects/monolith/monolith", notes)).toEqual({
      kind: "note",
      id: "Projects/monolith/monolith",
    });
  });
  it("_index i _tags są ignorowane, nieznany cel to missing", () => {
    expect(resolveLink("_index", notes)).toEqual({ kind: "ignored" });
    expect(resolveLink("Knowledge/_tags", notes)).toEqual({ kind: "ignored" });
    expect(resolveLink("nie-ma", notes)).toEqual({ kind: "missing" });
  });
});

describe("aggregateEdges", () => {
  it("pomija pary w jednym skupisku, łączy kierunki, obcina do limitu i liczy total", () => {
    const pairs = Array.from({ length: 50 }, (_, i) => ({
      a: `c${String(i).padStart(2, "0")}`,
      b: "z",
      weight: 1,
    }));
    const r = aggregateEdges(
      [...pairs, { a: "z", b: "c00", weight: 4 }, { a: "x", b: "x", weight: 9 }],
      40
    );
    expect(r.total).toBe(50);
    expect(r.edges).toHaveLength(40);
    expect(r.edges[0]).toEqual({ from: "c00", to: "z", weight: 5 });
    expect(r.edges[39].from).toBe("c39");
  });
});

describe("composeGraph", () => {
  const projects = [P("nexus", "~/n"), P("monolith", "~/m")];
  const notes: RawNote[] = [
    note("Knowledge/a", {
      category: "tools",
      projects: ["monolith"],
      links: ["b", "Projects/monolith/monolith", "nie-ma", "_index"],
    }),
    note("Knowledge/b", { category: "tools", links: ["a", "Knowledge/b"] }),
    note("Knowledge/c", { category: "tools", projects: ["nexus", "ghost"], links: ["a"] }),
    note("Knowledge/d", { category: "rzadka", links: ["a"] }),
    note("AI-2030/x", { area: "ai2030", links: ["a"] }),
    note("Projects/monolith/monolith", {
      area: "project",
      projectId: "monolith",
      links: ["a", "a"],
    }),
    note("Projects/ghostproj/index", { area: "project", projectId: "ghostproj" }),
  ];
  const sources: MapSources = {
    sharedSections: [["nexus", "monolith", "unknown-x"]],
    notes,
    warnings: [],
  };
  const graph = composeGraph(projects, sources);

  it("buduje skupiska: projekty, Wiedza z „inne”, AI-2030, Skille", () => {
    expect(graph.clusters.map((c) => [c.id, c.size])).toEqual([
      ["monolith", 1],
      ["nexus", 0],
      ["knowledge:tools", 3],
      ["knowledge:inne", 1],
      ["ai-2030", 1],
      ["skille", 0],
    ]);
    expect(graph.clusters.at(-1)?.soon).toBe(true);
  });

  it("węzły: przypisane do skupisk, z liczbą powiązań; notatka nieznanego projektu pominięta", () => {
    expect(graph.nodes.map((n) => [n.id, n.cluster, n.links])).toEqual([
      ["AI-2030/x", "ai-2030", 1],
      ["Knowledge/a", "knowledge:tools", 9],
      ["Knowledge/b", "knowledge:tools", 2],
      ["Knowledge/c", "knowledge:tools", 2],
      ["Knowledge/d", "knowledge:inne", 1],
      ["Projects/monolith/monolith", "monolith", 3],
    ]);
  });

  it("krawędzie notatkowe: sumuje kierunki i duplikaty, pomija self i _index; projects: → krawędź project", () => {
    expect(graph.edges).toEqual([
      { from: "AI-2030/x", to: "Knowledge/a", weight: 1, type: "link" },
      { from: "Knowledge/a", to: "Knowledge/b", weight: 2, type: "link" },
      { from: "Knowledge/a", to: "Knowledge/c", weight: 1, type: "link" },
      { from: "Knowledge/a", to: "Knowledge/d", weight: 1, type: "link" },
      { from: "Knowledge/a", to: "Projects/monolith/monolith", weight: 3, type: "link" },
      { from: "Knowledge/a", to: "monolith", weight: 1, type: "project" },
      { from: "Knowledge/c", to: "nexus", weight: 1, type: "project" },
    ]);
  });

  it("krawędzie zagregowane: linki + projects: + sekcje Używają; dependencies liczy wszystkie pary", () => {
    expect(graph.clusterEdges).toEqual([
      { from: "knowledge:tools", to: "monolith", weight: 4 },
      { from: "ai-2030", to: "knowledge:tools", weight: 1 },
      { from: "knowledge:inne", to: "knowledge:tools", weight: 1 },
      { from: "knowledge:tools", to: "nexus", weight: 1 },
      { from: "monolith", to: "nexus", weight: 1 },
    ]);
    expect(graph.tiles).toEqual({
      neurons: { total: 6, knowledge: 4, ai2030: 1, projects: 1 },
      dependencies: 5,
    });
  });

  it("ostrzeżenia: nieznane projekty, nierozwiązane linki", () => {
    const text = graph.warnings.join("\n");
    expect(text).toContain("„ghost”");
    expect(text).toContain("„unknown-x”");
    expect(text).toContain("ghostproj");
    expect(text).toContain("nierozwiązane linki: 1");
  });
});
```

- [ ] **Krok 2: Czerwone:** `npx vitest run tests/unit/contexts/bc_map/services.test.ts 2>&1 | tail -30` → FAIL.
- [ ] **Krok 3: Zaimplementuj** funkcje wg reguł; usuń stary `composeGraph` i import `CONTINENT_IDS`.
- [ ] **Krok 4: Zielone:** ta sama komenda → PASS (testy `resolveAgentProject` i `toAgents` nadal przechodzą).
- [ ] **Krok 5: Commit**

```bash
git add contexts/bc_map/services.ts tests/unit/contexts/bc_map/services.test.ts
git commit -m "feat(mapa): skupiska notatek, rozwiązywanie linków i agregacja krawędzi" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Zadanie 3: DTO i router (`schemas.ts`, `router.ts`)

**Pliki:** zmiana `contexts/bc_map/schemas.ts`; testy `tests/unit/contexts/bc_map/schemas.test.ts`, `tests/unit/contexts/bc_map/router.test.ts`. `router.ts` bez zmian kodu (woła `toGraphDto(services.getGraph())`).

**Schematy zod i typy (eksport):**

```ts
export const MapClusterDtoSchema = z.object({
  id: z.string(), label: z.string(),
  group: z.enum(["projects", "knowledge", "ai2030", "skills"]),
  size: count, projectId: z.string().optional(),
  owner: z.enum(["personal", "work"]).optional(), soon: z.boolean().optional(),
});
export const MapNodeDtoSchema = z.object({ id: z.string(), label: z.string(), cluster: z.string(), links: count });
export const MapEdgeDtoSchema = z.object({
  from: z.string(), to: z.string(), weight: z.number().int().positive(), type: z.enum(["link", "project"]),
});
export const MapClusterEdgeDtoSchema = z.object({ from: z.string(), to: z.string(), weight: z.number().int().positive() });
// MapGraphDtoSchema = { clusters, nodes, edges, clusterEdges, tiles (jak dotąd, z blockers: null), warnings }
export type MapClusterDto, MapNodeDto, MapEdgeDto, MapClusterEdgeDto, MapGraphDto
```

`toGraphDto` kopiuje pola jawnie (opcjonalne `projectId`, `owner`, `soon` tylko gdy ustawione). `Agent` DTO bez zmian.

- [ ] **Krok 1: Testy (czerwone).** W `schemas.test.ts` zastąp fixture `graph`:

```ts
const graph: MapGraph = {
  clusters: [
    {
      id: "nexus",
      label: "NEXUS",
      group: "projects",
      size: 1,
      projectId: "nexus",
      owner: "personal",
    },
    { id: "skille", label: "Skille", group: "skills", size: 0, soon: true },
  ],
  nodes: [{ id: "Projects/nexus/nexus", label: "NEXUS", cluster: "nexus", links: 2 }],
  edges: [{ from: "Knowledge/a", to: "nexus", weight: 1, type: "project" }],
  clusterEdges: [{ from: "knowledge:tools", to: "nexus", weight: 3 }],
  tiles: { neurons: { total: 1, knowledge: 0, ai2030: 0, projects: 1 }, dependencies: 1 },
  warnings: ["w"],
};
```

i dodaj do `describe("toGraphDto")`:

```ts
it("kopiuje skupiska bez pustych pól opcjonalnych i niczego spoza schematu", () => {
  const dto = toGraphDto({ ...graph, nodes: [{ ...graph.nodes[0], cwd: "/home/u/x" } as never] });
  expect(JSON.stringify(dto)).not.toContain("/home/u");
  expect(dto.clusters[1]).toEqual({
    id: "skille",
    label: "Skille",
    group: "skills",
    size: 0,
    soon: true,
  });
  expect(dto.clusters[1]).not.toHaveProperty("projectId");
  expect(MapGraphDtoSchema.safeParse(dto).success).toBe(true);
});
```

W `router.test.ts` zmień mock w teście „zwraca graf jako DTO” na `{ clusters: [], nodes: [{ id: "Knowledge/a", label: "A", cluster: "knowledge:x", links: 0 }], edges: [], clusterEdges: [], tiles: {...jak było}, warnings: [] }` i asercję `expect(body.nodes).toHaveLength(1); expect(body.clusters).toEqual([]);`.

- [ ] **Krok 2: Czerwone:** `npx vitest run tests/unit/contexts/bc_map 2>&1 | tail -30` → FAIL w schemas/router.
- [ ] **Krok 3: Zaimplementuj** schematy i `toGraphDto`.
- [ ] **Krok 4: Zielone:** ta sama komenda → PASS (cały katalog `bc_map`).
- [ ] **Krok 5: Commit**

```bash
git add contexts/bc_map/schemas.ts tests/unit/contexts/bc_map/schemas.test.ts tests/unit/contexts/bc_map/router.test.ts
git commit -m "feat(mapa): DTO grafu ze skupiskami i krawędziami zagregowanymi" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Zadanie 4: matematyka globusa (`globeMath.ts`)

**Pliki:** zmiana `src/features/map/globeMath.ts`, `tests/unit/features/map/globeMath.test.ts`.

**Zmiany:**

- Usuń `LayoutNode`, `LayoutEdge`, `layoutNodes`. Zmień nazwę `globeRadius` → `fitRadius` (ta sama formuła `min(w,h)*0.36`). `rotate`, `rotationTo`, `arcPoints`, `fromLonLat`, `wrapAngle`, `isClick` bez zmian.
- Nowe stałe i funkcje:

```ts
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 6;
export const POINT_LABEL_ZOOM = 2.5;
export const PATCH_BASE = 0.1; // rad
export const PATCH_PER_SQRT = 0.045;
export const PATCH_GAP = 0.04;
export const MIN_HIT_RADIUS = 5; // px
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export type LayoutCluster = {
  id: string;
  group: "projects" | "knowledge" | "ai2030" | "skills";
  size: number;
  soon?: boolean;
};
export type LayoutClusterEdge = { from: string; to: string; weight: number };
export type ClusterPlacement = { center: Vec3; radius: number };

export function clampZoom(z: number): number; // [0.5, 6]; NaN → 1
export function stepZoom(z: number, factor: number): number; // clampZoom(z * factor)
export function patchRadius(c: LayoutCluster): number; // soon → 0.10; inaczej 0.10 + 0.045·√size
export function capPoint(center: Vec3, rho: number, phi: number): Vec3;
export function capOutline(center: Vec3, radius: number, n: number): Vec3[]; // n punktów w odległości `radius`
export function layoutPoints(center: Vec3, radius: number, count: number): Vec3[];
export function layoutClusters(
  clusters: LayoutCluster[],
  edges: LayoutClusterEdge[]
): Record<string, ClusterPlacement>;
export function project(p: Vec3, w: number, h: number, zoom = 1): Projected; // promień = fitRadius·clampZoom(zoom)
```

- Małe wspólne pomocniki (napisz bez uruchamiania; te same dla `capPoint` i relaksacji):

```ts
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const normalize = (v: Vec3): Vec3 => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};
function tangentBasis(c: Vec3): [Vec3, Vec3] {
  const helper: Vec3 = Math.abs(c.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const e1 = normalize(cross(helper, c));
  return [e1, cross(c, e1)];
}
```

- `capPoint(c, ρ, φ)` = `normalize(c·cosρ + (e1·cosφ + e2·sinφ)·sinρ)`.
- `layoutPoints(center, R, n)`: punkt `k` (0-based) = `capPoint(center, 0.92·R·√((k+0.5)/n), k·GOLDEN_ANGLE)`; `n = 0` → `[]`. Wywołujący przekazuje notatki posortowane po `links` malejąco, więc najbardziej powiązane są przy środku.
- `layoutClusters` (deterministyczny, bez losowości):
  1. Kolejność: stabilnie po grupie (`projects`=0, `knowledge`=1, `ai2030`=2, `skills`=3), w grupie jak w wejściu.
  2. Start: punkt `i` z `N`: `fromLonLat(i·GOLDEN_ANGLE, asin(1 − 2(i+0.5)/N))` (pasy szerokości odpowiadają grupom).
  3. Relaksacja: `ITER_MAIN = 120` iteracji z przyciąganiem krawędziami i `ITER_FINAL = 60` samego odpychania. W każdej iteracji dla par `i<j`: `d = acos(clamp(dot(ci,cj)))`, `minD = Ri + Rj + PATCH_GAP`; gdy `d < minD`: obie strony dostają przesunięcie `(minD − d)/2` rad wzdłuż stycznej od drugiej (styczna = `ci − cj` zrzutowane na płaszczyznę styczną w `ci`, znormalizowane; gdy `d < 1e-9` użyj `tangentBasis(ci)[0]` ze znakiem `+` dla `i`, `−` dla `j`). Gdy `d ≥ minD` i faza główna i istnieje krawędź `i–j` o wadze `w`: przyciąganie `min(0.004·ln(1+w), (d − minD)/2)` ku sobie. Po zsumowaniu przesunięć wszystkich par: `ci ← normalize(ci + disp_i)`.
  4. Zwróć `Record<id, { center, radius }>`; puste wejście → `{}`.
- `hitTest`: promień trafienia `Math.max(n.r, MIN_HIT_RADIUS) + pad`.

- [ ] **Krok 1: Testy (czerwone).** W `globeMath.test.ts`: usuń `describe("layoutNodes")` i stałą `CONT`, zmień import (`globeRadius` → `fitRadius`, dodaj `capOutline`, `clampZoom`, `layoutClusters`, `layoutPoints`, `patchRadius`, `stepZoom`, typ `LayoutCluster`), w teście `project` zamień `globeRadius` na `fitRadius`, i dodaj:

```ts
const KNOWLEDGE_SIZES = [55, 36, 34, 21, 20, 15, 8, 7, 6, 5, 5, 3];
const realistic = (): LayoutCluster[] => [
  ...Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, group: "projects" as const, size: 4 })),
  ...KNOWLEDGE_SIZES.map((size, i) => ({ id: `k${i}`, group: "knowledge" as const, size })),
  { id: "ai", group: "ai2030" as const, size: 4 },
  { id: "skille", group: "skills" as const, size: 0, soon: true },
];
const angle = (a: Vec3, b: Vec3) => Math.acos(Math.max(-1, Math.min(1, dot(a, b))));

describe("layoutClusters", () => {
  const edges = [
    { from: "k0", to: "p0", weight: 6 },
    { from: "k1", to: "p1", weight: 2 },
  ];
  it("puste wejście daje pusty układ", () => {
    expect(layoutClusters([], [])).toEqual({});
  });
  it("jest deterministyczny", () => {
    expect(JSON.stringify(layoutClusters(realistic(), edges))).toBe(
      JSON.stringify(layoutClusters(realistic(), edges))
    );
  });
  it("środki leżą na sferze jednostkowej, promienie wg wzoru", () => {
    const lay = layoutClusters(realistic(), edges);
    for (const { center } of Object.values(lay)) expect(len(center)).toBeCloseTo(1, 9);
    expect(lay.p0.radius).toBeCloseTo(0.1 + 0.045 * 2, 9);
    expect(lay.k0.radius).toBeCloseTo(0.1 + 0.045 * Math.sqrt(55), 9);
    expect(lay.skille.radius).toBeCloseTo(0.1, 9);
  });
  it("płaty 21 skupisk się nie nakładają", () => {
    const lay = layoutClusters(realistic(), edges);
    const ids = Object.keys(lay);
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = lay[ids[i]];
        const b = lay[ids[j]];
        expect(angle(a.center, b.center)).toBeGreaterThanOrEqual(a.radius + b.radius - 1e-6);
      }
    }
  });
  it("dwa skupiska startujące w tym samym miejscu nie dają NaN", () => {
    const lay = layoutClusters(
      [
        { id: "a", group: "projects", size: 1 },
        { id: "b", group: "projects", size: 1 },
      ],
      []
    );
    for (const { center } of Object.values(lay))
      expect(Number.isNaN(center.x + center.y + center.z)).toBe(false);
  });
});

describe("patchRadius", () => {
  it("rośnie z pierwiastkiem liczby notatek, Skille ma stały", () => {
    expect(patchRadius({ id: "x", group: "projects", size: 0 })).toBeCloseTo(0.1, 9);
    expect(patchRadius({ id: "x", group: "knowledge", size: 36 })).toBeCloseTo(0.1 + 0.045 * 6, 9);
    expect(patchRadius({ id: "s", group: "skills", size: 99, soon: true })).toBeCloseTo(0.1, 9);
  });
});

describe("layoutPoints / capOutline", () => {
  const center = fromLonLat(0.7, 0.3);
  it("zwraca n punktów na sferze, w czapie 0,92·R, deterministycznie", () => {
    const pts = layoutPoints(center, 0.4, 55);
    expect(pts).toHaveLength(55);
    for (const p of pts) {
      expect(len(p)).toBeCloseTo(1, 9);
      expect(angle(p, center)).toBeLessThanOrEqual(0.4 * 0.92 + 1e-9);
    }
    expect(JSON.stringify(layoutPoints(center, 0.4, 55))).toBe(JSON.stringify(pts));
  });
  it("pierwszy punkt jest najbliżej środka, a punkty są różne", () => {
    const pts = layoutPoints(center, 0.4, 20);
    const d0 = angle(pts[0], center);
    for (const p of pts.slice(1)) expect(angle(p, center)).toBeGreaterThan(d0);
    for (let i = 0; i < pts.length; i += 1) {
      for (let j = i + 1; j < pts.length; j += 1)
        expect(dist(pts[i], pts[j])).toBeGreaterThan(1e-3);
    }
  });
  it("zero notatek daje pustą listę; obwiednia leży w stałej odległości od środka", () => {
    expect(layoutPoints(center, 0.4, 0)).toEqual([]);
    for (const p of capOutline(center, 0.4, 24))
      expect(dot(p, center)).toBeCloseTo(Math.cos(0.4), 9);
  });
  it("działa też przy środku na biegunie", () => {
    const pole = { x: 0, y: 1, z: 0 };
    for (const p of layoutPoints(pole, 0.3, 10)) expect(len(p)).toBeCloseTo(1, 9);
  });
});

describe("zoom", () => {
  it("clampZoom przycina do 0,5–6, NaN daje 1", () => {
    expect(clampZoom(0.1)).toBe(0.5);
    expect(clampZoom(99)).toBe(6);
    expect(clampZoom(2)).toBe(2);
    expect(clampZoom(Number.NaN)).toBe(1);
  });
  it("stepZoom mnoży i przycina", () => {
    expect(stepZoom(1, 1.25)).toBeCloseTo(1.25, 9);
    expect(stepZoom(5, 1.25)).toBe(6);
    expect(stepZoom(0.55, 0.8)).toBe(0.5);
  });
  it("project skaluje promień kuli przez zoom, a fitRadius zależy od krótszego boku", () => {
    expect(fitRadius(400, 300)).toBeCloseTo(300 * 0.36, 9);
    const x1 = project({ x: 1, y: 0, z: 0 }, 400, 300).x - 200;
    const x2 = project({ x: 1, y: 0, z: 0 }, 400, 300, 2).x - 200;
    expect(x2).toBeCloseTo(2 * x1, 9);
  });
});

describe("hitTest: minimalny promień", () => {
  it("mały punkt da się trafić w granicach 5 px + pad", () => {
    const n = [{ id: "p", x: 100, y: 100, z: 0.5, r: 1 }];
    expect(hitTest(n, 108, 100)).toBe("p");
    expect(hitTest(n, 110, 100)).toBeNull();
  });
});
```

- [ ] **Krok 2: Czerwone:** `npx vitest run tests/unit/features/map/globeMath.test.ts 2>&1 | tail -40` → FAIL.
- [ ] **Krok 3: Zaimplementuj** wg reguł. Jeśli test „płaty się nie nakładają” jest czerwony mimo poprawnej implementacji, zmniejsz `PATCH_PER_SQRT` do 0,04 albo zwiększ `ITER_FINAL`; nie osłabiaj testu. Zmień stałe także w teście wzoru promienia (0,045 → nowa wartość) i w specu (`D17`).
- [ ] **Krok 4: Zielone:** ta sama komenda → PASS.
- [ ] **Krok 5: Commit**

```bash
git add src/features/map/globeMath.ts tests/unit/features/map/globeMath.test.ts
git commit -m "feat(mapa): układ skupisk na kuli, punkty w płatach, zoom w globeMath" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Zadanie 5: małe komponenty UI (`selection.ts`, `MapNodeList`, `MapClusterPanel`, `GlobeControls`, `mapTiles`)

**Pliki:** nowe `src/features/map/selection.ts`, `MapClusterPanel.tsx`, `GlobeControls.tsx`; zmiany `MapNodeList.tsx`, `mapTiles.ts`; testy `tests/unit/features/map/selection.test.ts`, `MapClusterPanel.test.tsx`, `GlobeControls.test.tsx`, `MapNodeList.test.tsx`, `mapTiles.test.ts`.

**Interfejsy:**

```ts
// selection.ts
import type { MapEdgeDto, MapNodeDto } from "@/contexts/bc_map/schemas";
export type MapSelection = { kind: "cluster" | "note"; id: string };
export type Neighbor = { id: string; label: string; weight: number };
/** Sąsiedzi po krawędziach `link` (para nieskierowana); weight malejąco, potem label, potem id. */
export function noteNeighbors(noteId: string, nodes: MapNodeDto[], edges: MapEdgeDto[]): Neighbor[];

// MapNodeList.tsx — lista SKUPISK
props: { clusters: MapClusterDto[]; selectedId: string | null; onSelect: (id: string) => void }
// opis: soon → "<label> (wkrótce)"; inaczej "<label>, <size> notatek"; aria-label listy "Skupiska sieci NEXUS"

// MapClusterPanel.tsx
props: { clusters: MapClusterDto[]; nodes: MapNodeDto[]; edges: MapEdgeDto[]; selection: MapSelection | null; onSelect: (s: MapSelection) => void }
// brak zaznaczenia: <p>Wybierz skupisko lub punkt na globusie.</p>
// skupisko: <h2>{label}</h2>, "{size} notatek", <ul> przycisków notatek (links malejąco, potem label); skupisko soon: "wkrótce"
// notatka: <h2>{label}</h2>, "Skupisko: {cluster.label}", "Powiązania: {links}", <ul> przycisków sąsiadów (max 30) z wagą w opisie
// klik przycisku notatki/sąsiada → onSelect({ kind: "note", id })

// GlobeControls.tsx
props: { zoom: number; onZoomIn: () => void; onZoomOut: () => void; onFit: () => void }
// <div className="map-zoom" role="group" aria-label="Powiększenie">: przyciski "−" (aria-label "Oddal"), "+" ("Przybliż"), "Dopasuj" ("Dopasuj do okna"), <span> `${Math.round(zoom*100)}%`
```

`mapTiles.ts`: meta kafla „Zależności” → `"połączone skupiska (współdzielone komponenty, linki, projekty)"`; reszta bez zmian.

- [ ] **Krok 1: Testy (czerwone).**

`selection.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { noteNeighbors } from "@/src/features/map/selection";

const nodes = ["a", "b", "c", "d"].map((id) => ({
  id,
  label: id.toUpperCase(),
  cluster: "k",
  links: 0,
}));
describe("noteNeighbors", () => {
  it("zbiera sąsiadów w obie strony, sortuje po wadze, ignoruje krawędzie project", () => {
    const edges = [
      { from: "a", to: "b", weight: 2, type: "link" as const },
      { from: "c", to: "a", weight: 5, type: "link" as const },
      { from: "a", to: "k", weight: 1, type: "project" as const },
      { from: "b", to: "d", weight: 1, type: "link" as const },
    ];
    expect(noteNeighbors("a", nodes, edges)).toEqual([
      { id: "c", label: "C", weight: 5 },
      { id: "b", label: "B", weight: 2 },
    ]);
  });
});
```

`MapClusterPanel.test.tsx`:

```tsx
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapClusterPanel } from "@/src/features/map/MapClusterPanel";

afterEach(() => cleanup());
const clusters = [
  { id: "knowledge:tools", label: "tools", group: "knowledge" as const, size: 2 },
  { id: "skille", label: "Skille", group: "skills" as const, size: 0, soon: true },
];
const nodes = [
  { id: "Knowledge/a", label: "Alfa", cluster: "knowledge:tools", links: 5 },
  { id: "Knowledge/b", label: "Beta", cluster: "knowledge:tools", links: 1 },
];
const edges = [{ from: "Knowledge/a", to: "Knowledge/b", weight: 2, type: "link" as const }];
const base = { clusters, nodes, edges };

describe("MapClusterPanel", () => {
  it("bez zaznaczenia podpowiada, co zrobić", () => {
    render(<MapClusterPanel {...base} selection={null} onSelect={() => {}} />);
    expect(screen.getByText(/Wybierz skupisko/)).toBeInTheDocument();
  });
  it("skupisko: lista notatek od najbardziej powiązanej, klik zaznacza notatkę", async () => {
    const onSelect = vi.fn();
    render(
      <MapClusterPanel
        {...base}
        selection={{ kind: "cluster", id: "knowledge:tools" }}
        onSelect={onSelect}
      />
    );
    expect(screen.getByRole("heading", { name: "tools" })).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Alfa", "Beta"]);
    await userEvent.setup().click(buttons[1]);
    expect(onSelect).toHaveBeenCalledWith({ kind: "note", id: "Knowledge/b" });
  });
  it("notatka: skupisko, powiązania i sąsiedzi", async () => {
    const onSelect = vi.fn();
    render(
      <MapClusterPanel
        {...base}
        selection={{ kind: "note", id: "Knowledge/a" }}
        onSelect={onSelect}
      />
    );
    expect(screen.getByText(/Skupisko: tools/)).toBeInTheDocument();
    expect(screen.getByText(/Powiązania: 5/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Beta/ }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "note", id: "Knowledge/b" });
  });
  it("Skille: informacja „wkrótce” bez listy notatek", () => {
    render(
      <MapClusterPanel
        {...base}
        selection={{ kind: "cluster", id: "skille" }}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText(/wkrótce/)).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
```

`GlobeControls.test.tsx`:

```tsx
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { GlobeControls } from "@/src/features/map/GlobeControls";

afterEach(() => cleanup());
it("przyciski wywołują przybliżenie, oddalenie i dopasowanie; pokazuje procent", async () => {
  const [zin, zout, fit] = [vi.fn(), vi.fn(), vi.fn()];
  const user = userEvent.setup();
  render(<GlobeControls zoom={1.25} onZoomIn={zin} onZoomOut={zout} onFit={fit} />);
  expect(screen.getByText("125%")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Przybliż" }));
  await user.click(screen.getByRole("button", { name: "Oddal" }));
  await user.click(screen.getByRole("button", { name: "Dopasuj do okna" }));
  expect([zin, zout, fit].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
});
```

`MapNodeList.test.tsx` (zastąp zawartość testu):

```tsx
const clusters = [
  { id: "nexus", label: "NEXUS", group: "projects" as const, size: 4 },
  { id: "knowledge:tools", label: "tools", group: "knowledge" as const, size: 300 },
  { id: "skille", label: "Skille", group: "skills" as const, size: 0, soon: true },
];
// test 1: Tab + Enter → onSelect("nexus")
// test 2: getByRole("button", { name: /tools.*300/ }) ma aria-current="true" dla selectedId="knowledge:tools"; getByRole("button", { name: /Skille.*wkrótce/ }) istnieje
```

`mapTiles.test.ts`: w fixture `graph` dodaj `clusters: [], clusterEdges: []`.

- [ ] **Krok 2: Czerwone:** `npx vitest run tests/unit/features/map 2>&1 | tail -40` → FAIL (nowe pliki nie istnieją, `MapNodeList` ma stary interfejs).
- [ ] **Krok 3: Zaimplementuj** komponenty wg interfejsów; style klas `map-cluster-panel*`, `map-zoom*` w zadaniu 7.
- [ ] **Krok 4: Zielone:** ta sama komenda → PASS (`MapAgentsPanel`, `MapBlockersPanel` bez zmian).
- [ ] **Krok 5: Commit**

```bash
git add src/features/map/selection.ts src/features/map/MapClusterPanel.tsx src/features/map/GlobeControls.tsx src/features/map/MapNodeList.tsx src/features/map/mapTiles.ts tests/unit/features/map
git commit -m "feat(mapa): panel zaznaczenia, lista skupisk i przyciski zoomu" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Zadanie 6: `Globe.tsx` (skupiska, łuki, zoom, wejście)

**Pliki:** przepisanie `src/features/map/Globe.tsx`. Brak testu jednostkowego (jsdom nie ma canvasa; jak w etapie 1) — weryfikacja w zadaniu 8.

**Props:**

```ts
export type GlobeProps = {
  clusters: MapClusterDto[];
  nodes: MapNodeDto[];
  edges: MapEdgeDto[];
  clusterEdges: MapClusterEdgeDto[];
  selection: MapSelection | null;
  /** Zmiana `tick` obraca globus do skupiska lub notatki `id`. */
  focus: { id: string; tick: number } | null;
  paused?: boolean; // zatrzymuje auto-obrót
  onSelect: (s: MapSelection) => void;
  ariaLabel: string;
};
```

**Dane pochodne (`useMemo`):**

- `placement = layoutClusters(clusters.map(({id,group,size,soon}) => ({id,group,size,soon})), clusterEdges)`.
- `notePos: Record<noteId, Vec3>`: dla każdego skupiska notatki posortowane po `links` malejąco, potem `id`; pozycje z `layoutPoints(center, radius, count)`.
- `noteById`, `clusterById`, `notesOfCluster`.
- `outlines: Record<clusterId, Vec3[]>` = `capOutline(center, radius, 40)`.

**Stan i wejście (refy, bez przerysowań Reacta w pętli):** `view {yaw, pitch}` jak dotąd; `zoom` (bieżący) i `zoomTarget`; `pointers: Map<number, {x,y}>`; `React.useState` tylko dla etykiety procentowej (`zoomLabel`, aktualizowany przy zmianie `zoomTarget`).

- `wheel` (`{ passive: false }`, `preventDefault`): `zoomTarget = stepZoom(zoomTarget, e.deltaY < 0 ? 1.1 : 1/1.1)`.
- Przyciski (`GlobeControls`): `+` → `stepZoom(·, 1.25)`, `−` → `stepZoom(·, 0.8)`, „Dopasuj” → `zoomTarget = 1`.
- Klawisze na kontenerze (`div` z `role="application"`, `tabIndex={0}`, `aria-label` = `ariaLabel`): `+`/`=` zoom in, `-` zoom out, `0` dopasuj (tylko gdy `!e.ctrlKey && !e.metaKey`).
- Szczypanie: przy dwóch aktywnych wskaźnikach `zoomTarget = zoom = stepZoom(zoom, dist/prevDist)`, obrót przeciąganiem wyłączony, klik nie jest rozpoznawany.
- Pętla: `zoom += (zoomTarget − zoom)·0.25` (gdy `prefers-reduced-motion`: `zoom = zoomTarget` i `draw()` po każdej zmianie); reszta (auto-obrót, `target` obrotu do fokusu, drag, hover, `ResizeObserver`) jak w obecnym pliku.
- `ResizeObserver` obserwuje kontener płótna i woła `draw()`; rozmiar bufora z `devicePixelRatio` jak dotąd.

**Kolejność rysowania w `draw()`** (promień kuli `R = fitRadius(w,h)·zoom`; wszystkie rzuty przez `project(rotate(p, yaw, pitch), w, h, zoom)`):

1. Dysk kuli (jak dotąd).
2. Płaty: dla każdego skupiska zamknięta ścieżka z `outlines`; wypełnienie `alpha 0.06`, obrys `alpha 0.28`; skupisko zaznaczone (lub skupisko zaznaczonej notatki) obrys `alpha 0.9` i grubość 2. Przy `center.z < 0` alfy × 0,3. Skille (`soon`): tylko przerywany obrys.
3. Łuki zagregowane: `arcPoints(centerA, centerB, 28)`; grubość `1 + min(5, log2(1 + weight))`; `alpha 0.55` (przód) / `0.14` (tył); gdy jest zaznaczenie, łuki niezwiązane z jego skupiskiem ×0,35, związane w kolorze `accent`.
4. Łuki notatkowe (tylko przy zaznaczeniu): zbiór krawędzi = dla skupiska — krawędzie, w których któryś koniec jest notatką tego skupiska; dla notatki — krawędzie przy niej. Kolejność: najpierw obu końców w zbiorze zaznaczenia, potem pozostałe, wewnątrz po `from`, `to`; **co najwyżej 400**. `link`: `arcPoints(pos[from], pos[to], 8)`; `project`: od pozycji notatki do `center` skupiska projektu. Styl: `accent`, grubość 1, `alpha 0.45`.
5. Punkty (sortowane rosnąco po `z`): promień `2.2·scale` (zaznaczona notatka `4.5·scale` + biały pierścień); kolor wg grupy skupiska (`projects`/`ai2030` = `accent`, `knowledge` = `ok`); `alpha` 1 (przód) / 0,25 (tył); przy zaznaczeniu punkty spoza zaznaczonego skupiska ×0,5.
6. Etykiety skupisk: nazwa w środku płatu (`z > −0.2`), czcionka `11·scale` px mono; Skille z dopiskiem „(wkrótce)”.
7. Etykiety punktów: tylko gdy `zoom ≥ POINT_LABEL_ZOOM`, tylko `z > 0.1`, najwyżej 150 sztuk, z unikaniem nakładania (lista prostokątów już narysowanych etykiet, pominięcie podpisu, który przecina którykolwiek z nich).
8. `projectedNotes` i `projectedClusters` (`ProjectedNode[]`) zapisane do refów dla hit-testu: notatka `r = 3.5·scale`; skupisko: `r = max(10, sin(radius)·R·scale)` w środku płatu.

**Klik (`pointerup` po `isClick`)**: najpierw `hitTest(projectedNotes, x, y)` → `onSelect({kind:"note", id})`; jeśli brak, `hitTest(projectedClusters, x, y)` → `onSelect({kind:"cluster", id})`. Kursor `pointer` nad trafieniem, inaczej `grab`.

**Fokus:** `focus.id` jest id skupiska (pozycja = `center`) albo notatki (pozycja z `notePos`); `rotationTo(pos)`; `prefers-reduced-motion` → natychmiastowe ustawienie widoku.

**Render:** `<div className="map-globe" role="application" tabIndex={0} aria-label=… onKeyDown=…><canvas className="map-canvas__el" role="img" aria-label={ariaLabel} /><GlobeControls … /></div>`. Gdy `eslint` zgłosi `jsx-a11y/no-noninteractive-tabindex` lub podobne: zostaw `role="application"`; przy dalszych błędach usuń `tabIndex` i obsługuj klawisze na kontenerze `.map-stage` w `MapView`.

- [ ] **Krok 1: Przepisz `Globe.tsx`** wg powyższego (zachowaj `readPalette`, `FALLBACK`, `AUTO_SPEED`, `PITCH_LIMIT`).
- [ ] **Krok 2: Test dymny:** `npx vitest run tests/unit/features/map 2>&1 | tail -20` → nadal PASS (Globe nie ma testu; sprawdzamy, że nic nie pękło).
- [ ] **Krok 3: Commit**

```bash
git add src/features/map/Globe.tsx
git commit -m "feat(mapa): globus ze skupiskami, łukami zagregowanymi, zoomem i szczypaniem" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Zadanie 7: `MapView`, CSS i okno (`MapView.tsx`, `map.css`)

**Pliki:** zmiana `src/features/map/MapView.tsx`, `src/features/map/map.css`.

**`MapView.tsx`:**

- Stan: `selection: MapSelection | null` (zamiast `selectedId`), `focus`, `listFocused` jak dotąd.
- `activate(sel: MapSelection)`: `setSelection(sel)`; `setFocus({ id: sel.id, tick: … })`; gdy `sel.kind === "cluster"` i skupisko ma `projectId` → `onOpenProject(projectId)` (jak dziś klik w projekt otwiera kartę Projekty).
- Lista skupisk: `<MapNodeList clusters=… selectedId={selection?.kind === "cluster" ? selection.id : null} onSelect={(id) => activate({ kind: "cluster", id })} />`.
- `<Globe clusters nodes edges clusterEdges selection focus paused={listFocused} onSelect={activate} ariaLabel={...} />`, `ariaLabel = Globus sieci NEXUS: ${clusters.length} skupisk, ${nodes.length} notatek, ${edges.length} połączeń`.
- `caption`: skupisko → `${label}: ${size} notatek` (Skille: `Skille: wkrótce`); notatka → `label`.
- `<aside className="map-sidebar">`: na górze `<MapClusterPanel clusters nodes edges selection onSelect={activate} />`, potem agenci i blokery jak dotąd.
- `projectNames` z `clusters` z `projectId`: `Object.fromEntries(clusters.filter(c => c.projectId).map(c => [c.projectId, c.label]))`.
- Legenda: `<li>` „łuk: powiązania między skupiskami (grubość = liczba)”, `<li>` „klik w skupisko lub punkt pokazuje jego linki”, `<li>` „Skille: wkrótce, bez powiązań”.

**`map.css` (nowe/zmienione reguły; style nowych komponentów z prefiksem `map-`):**

```css
[data-card="mapa"] .map {
  --map-above: 300px;
} /* wysokość nagłówka i kafli nad płótnem; dostrój w przeglądarce */
.map-canvas {
  height: max(420px, calc(100dvh - var(--map-above)));
  min-height: 420px;
}
.map-globe {
  position: relative;
  width: 100%;
  height: 100%;
  outline: none;
}
.map-globe:focus-visible {
  box-shadow: inset 0 0 0 2px var(--accent);
  border-radius: var(--r-lg);
}
.map-zoom {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.map-zoom button {
  /* jak .map-panel__btn: padding 4px 10px, tło --surface-2, ramka --line, radius --r-md, font 12px */
}
.map-zoom span {
  color: var(--muted);
  font-size: 12px;
  font-family: var(--font-mono);
  min-width: 40px;
  text-align: right;
}
.map-cluster-panel {
  /* jak .map-panel */
  max-height: 360px;
  overflow: auto;
}
.map-cluster-panel ul {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.map-cluster-panel button {
  width: 100%;
  text-align: left;
  padding: 4px 8px;
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  font-size: 12px;
  cursor: pointer;
}
.map-cluster-panel button[aria-current="true"],
.map-cluster-panel button:focus-visible {
  border-color: var(--accent);
  outline: none;
}
@media (prefers-reduced-motion: reduce) {
  .map-globe {
    scroll-behavior: auto;
  }
}
```

Usuń stare `height: min(60vh, 520px); min-height: 320px;` z `.map-canvas`. Kolizję `.chip` zostaw (znane ryzyko ze specu etapu 1, sprawdzane w przeglądzie).

- [ ] **Krok 1: Zaimplementuj** zmiany w `MapView.tsx` i `map.css`.
- [ ] **Krok 2: Typecheck lokalnie (pierwszy sensowny):** `npx tsc --noEmit 2>&1 | head -30` → bez błędów. (Szczegółowy pełny przebieg i tak robi `cursor` w zadaniu 8.)
- [ ] **Krok 3: Testy mapy:** `npx vitest run tests/unit/features/map tests/unit/contexts/bc_map 2>&1 | tail -20` → PASS.
- [ ] **Krok 4: Commit**

```bash
git add src/features/map/MapView.tsx src/features/map/map.css
git commit -m "feat(mapa): widok wypełniający okno, panel skupiska i legenda" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Zadanie 8: weryfikacja (pomocnik + test na żywo)

- [ ] **Krok 1: Pełna weryfikacja przez `cursor`** (tier light, zgodnie z pamięcią projektu; nie używaj `hc wait`):

```bash
scripts/ask-helper.sh --role task --approve-allowed --tier light --timeout 900 cursor "W ~/projects/Brain_7224/Monolith uruchom kolejno: npx tsc --noEmit, npm run lint, npx vitest run, npm run build. Niczego nie edytuj. Odpowiedz: 'przeszło' dla każdego polecenia albo listę plik:linia + przyczyna. Dla vitest podaj też liczbę plików i testów."
```

Oczekiwane: cztery polecenia przeszły; `tests/unit/architecture.static.test.ts` i `no-model-api.static.test.ts` zielone. Czerwony test architektury naprawiasz kodem, nie testem.

- [ ] **Krok 2: Endpoint na tymczasowym serwerze** (port 3102; procesów na 3100 i 3101 nie ruszaj; po teście zatrzymaj własny proces):

```bash
npm run dev -- -p 3102 > /tmp/claude-1000/-home-miro7224-projects-Brain-7224-Monolith/0830f53a-61e5-4bc7-bba8-205221a85c90/scratchpad/dev3102.log 2>&1 &
sleep 8
curl -s localhost:3102/api/map/graph | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['clusters']), len(d['nodes']), len(d['edges']), len(d['clusterEdges']), d['tiles']); print(d['warnings'][:5])"
curl -s localhost:3102/api/map/graph | grep -c '/home/'   # oczekiwane 0
```

Oczekiwane: ok. 20–22 skupiska, ok. 250–260 węzłów, > 1000 krawędzi, `clusterEdges` ≤ 40, brak ścieżek `/home/`. Ostrzeżenia przejrzyj: dużo „nierozwiązane linki” to sygnał, że `resolveLink` czegoś nie łapie (sprawdź próbkę celów w treści notatek).

- [ ] **Krok 3: Przegląd w przeglądarce** (`localhost:3100/dashboard#mapa` po restarcie albo port 3102; Alt+8). Lista kontrolna:
  1. Globus wypełnia okno, brak pustej połowy ekranu; zmiana rozmiaru okna przelicza kulę bez przeładowania.
  2. `+`, `−`, kółko, `0` i „Dopasuj do okna” działają; zoom 0,5×–6×; po „Dopasuj” procent wraca do 100%.
  3. Widać skupiska (płaty z punktami), podpisy skupisk, grube łuki między nimi; Skille to przerywany obrys.
  4. Klik w skupisko: obrót, notatkowe linki, lista notatek w panelu; skupisko projektu otwiera kartę Projekty. Klik w punkt: jego linki i sąsiedzi w panelu.
  5. Przy zoomie ≥ 2,5× pojawiają się podpisy punktów bez nakładania.
  6. Lista skupisk z klawiatury (Tab, Enter) i „ogranicz ruch” (statyczny globus, natychmiastowy zoom).
  7. Kolizja klasy `.chip` z innymi kartami (porównaj panel agentów z innymi widokami).
  8. Płynność przy zaznaczeniu największego skupiska (Wiedza: `ai-tools`) i zoomie 6×.
- [ ] **Krok 4: Zatrzymaj własny serwer:** `kill %1` (albo znajdź PID po porcie 3102). Nie zabijaj procesów na 3100/3101.
- [ ] **Krok 5: Poprawki** po przeglądzie (np. `--map-above`, gęstość, stałe `PATCH_*`) jako osobne drobne commity `fix(mapa): …`; stałe układu zmieniasz równocześnie w teście wzoru i w specu.

---

### Zadanie 9: synchronizacja dokumentów i review

**Pliki:** `docs/superpowers/specs/2026-11-14-karta-mapa-design.md`, `docs/superpowers/specs/2026-11-14-karta-mapa-skupiska-design.md`.

- [ ] **Krok 1: Stary spec:** na górze (pod tytułem) dopisz: `> Częściowo zastąpiony przez 2026-11-14-karta-mapa-skupiska-design.md: D4, D5, „Układ na kuli”, kafle „Neurony” i „Zależności”, interakcja i widok płótna. D1–D3, D6–D13 obowiązują.`
- [ ] **Krok 2: Nowy spec, trzy poprawki do stanu faktycznego:**
  1. §4 `MapClusterPanel`: „liczba linków wychodzących/przychodzących” → „liczba powiązań i lista sąsiadów” (krawędzie są nieskierowane, D18).
  2. §6: zoom względem `fitRadius`; „Dopasuj” = zoom 1× (promień zawsze podąża za rozmiarem okna, osobna flaga śledzenia nie jest potrzebna); klawisze `+`, `−`, `0` działają przy fokusie na kontenerze globusa (`role="application"`).
  3. §4 `globeMath`: `globeRadius` zmienia nazwę na `fitRadius`; dodane `capPoint`, `capOutline`, `stepZoom`, `patchRadius`; ewentualne zmiany stałych `PATCH_*` z kroku 8.
- [ ] **Krok 3: Commit**

```bash
git add docs/superpowers/specs
git commit -m "docs(mapa): synchronizacja specu etapu 1 i specu skupisk z implementacją" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Krok 4: Review diffa (za zgodą użytkownika):** zapytaj, czy zlecić niezależny przegląd `agy` (`--role review`, tier deep, nowa karta = `--fresh`). Opinie traktuj jak hipotezy i weryfikuj w kodzie.
- [ ] **Krok 5: Zakończenie gałęzi:** push i PR dopiero na prośbę użytkownika (`superpowers:finishing-a-development-branch`).

---

## Samoocena planu (spec → zadania)

| Wymaganie ze specu                                                  | Zadanie                                   |
| ------------------------------------------------------------------- | ----------------------------------------- |
| D14 skupiska (projekty, AI-2030, Wiedza, Skille)                    | 2 (`buildClusters`)                       |
| D15 pierwsza kategoria, „inne” (<3)                                 | 1 (`primaryCategory`), 2                  |
| D16 krawędzie notatkowe + agregacja 40 + szczegóły po kliku         | 2, 6                                      |
| D17 układ płatów i spirala w płacie                                 | 4                                         |
| D18 rozwiązywanie linków                                            | 1 (`extractWikiLinks`), 2 (`resolveLink`) |
| D19 kafle                                                           | 2, 5                                      |
| D20 płótno w oknie, zoom −/+, dopasowanie                           | 4, 5, 6, 7                                |
| Prywatność DTO, brak ścieżek bezwzględnych                          | 3, 8 (krok 2)                             |
| Dostępność (lista skupisk, panel notatek, klawisze, reduced-motion) | 5, 6, 7                                   |
| Test architektury bez zmian                                         | 8                                         |
| Sprawdzenie gęstości i wydajności na żywo                           | 8 (krok 3)                                |

Typy używane w późniejszych zadaniach zdefiniowane wcześniej: `RawNote`, `MapCluster`, `MapNode`, `MapEdge`, `MapClusterEdge` (zad. 1) → `MapClusterDto` itd. (zad. 3) → `MapSelection`, `noteNeighbors` (zad. 5) → `Globe` i `MapView` (zad. 6–7).
