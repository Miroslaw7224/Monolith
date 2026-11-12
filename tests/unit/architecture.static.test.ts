// @vitest-environment node
/**
 * Test architektury: reguły importów 1–9 ze specu struktury kontekstów (§6).
 * Część A sprawdza silnik reguł na sztucznych danych; część B skanuje prawdziwe repo
 * z zamkniętą listą znanych wyjątków (BASELINE).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** `from` i `to` zawsze znormalizowane (jak wynik `normalizePath`/`normalize`). */
type Edge = { from: string; to: string; typeOnly: boolean };
type ImportRef = { specifier: string; typeOnly: boolean; statement: string };

// ─── silnik ───────────────────────────────────────────────────────────────────

/** Ścieżka względem korzenia repo, separator `/`, bez rozszerzenia i bez `/index`. */
function normalizePath(p: string): string {
  let out = path.posix.normalize(p.replace(/\\/g, "/")).replace(/\.(?:[cm]?[jt]s|[jt]sx)$/, "");
  if (out.endsWith("/index")) out = out.slice(0, -"/index".length);
  return out;
}

/** Rozwiązuje specyfikator importu do ścieżki repo; `null` dla pakietów (`zod`, `node:fs`). */
function normalize(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) return normalizePath(specifier.slice(2));
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return normalizePath(path.posix.join(path.posix.dirname(fromFile), specifier));
  }
  return null;
}

/** Importy z tekstu: `import … from "x"`, `export … from "x"`, `import("x")`, `require("x")`. */
function extractImports(text: string): ImportRef[] {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const out: ImportRef[] = [];
  const staticRe = /^\s*(?:import|export)\s+(type\s+)?(?:[^;"'`]*?\s+from\s+)?["']([^"']+)["']/gm;
  for (const m of src.matchAll(staticRe)) {
    out.push({ specifier: m[2], typeOnly: m[1] !== undefined, statement: m[0].trim() });
  }
  for (const m of src.matchAll(/import\(\s*(["'`])([^"'`$]+)\1\s*\)/g)) {
    out.push({ specifier: m[2], typeOnly: false, statement: m[0].trim() });
  }
  for (const m of src.matchAll(/require\(\s*(["'`])([^"'`$]+)\1\s*\)/g)) {
    out.push({ specifier: m[2], typeOnly: false, statement: m[0].trim() });
  }
  return out;
}

const within = (p: string, dir: string) => p === dir || p.startsWith(`${dir}/`);
const isRoute = (p: string) => within(p, "app/api") && p.endsWith("/route");

type CtxInfo = { ctx: string; layer: string };
/** `contexts/<ctx>/<layer>/…` → `{ ctx, layer }` (każdy podkatalog `contexts/` to kontekst, także bez prefiksu `bc_`, żeby reguł nie dało się ominąć nazwą); `layer` pusty, gdy brak segmentu. */
function ctxInfo(p: string): CtxInfo | null {
  const parts = p.split("/");
  if (parts[0] !== "contexts" || !parts[1]) return null;
  return { ctx: parts[1], layer: parts[2] ?? "" };
}

/** Kierunek zależności wewnątrz kontekstu (R3). `schemas → models` tylko jako `import type`. */
const LAYER_ALLOWED: Record<string, string[]> = {
  router: ["services", "schemas"],
  services: ["repositories", "models"],
  repositories: ["models"],
  schemas: [],
  models: [],
};

const ROUTE_REEXPORT = /^export\s*(?:\{[^}]*\}|\*)\s*from\s*["'][^"']*\/router(?:\/[^"']+)?["']/;

/**
 * Zwraca posortowaną listę naruszeń bez duplikatów: `<from> → <to> (reguła N)`;
 * dla cyklu (R8) `cykl: <a> → <b> → <a> (reguła 8)`.
 * `routeFiles`: znormalizowana ścieżka trasy (`app/api/.../route`) → treść pliku.
 */
function violations(edges: Edge[], routeFiles: Map<string, string>): string[] {
  const out = new Set<string>();
  const add = (e: Edge, rule: number) => out.add(`${e.from} → ${e.to} (reguła ${rule})`);

  for (const e of edges) {
    const f = ctxInfo(e.from);
    const t = ctxInfo(e.to);

    // R1: UI nie importuje serwerowych warstw (z kontekstu wolno tylko `schemas`).
    if (
      within(e.from, "src") &&
      ((t && t.layer !== "schemas") ||
        within(e.to, "services") ||
        within(e.to, "lib/nexus") ||
        within(e.to, "lib/http"))
    ) {
      add(e, 1);
    }

    // R2: inny kontekst tylko przez jego warstwę `services` (z warstwy `services`).
    if (f && t && f.ctx !== t.ctx && (t.layer !== "services" || f.layer !== "services")) {
      add(e, 2);
    }

    // R3: kierunek warstw wewnątrz kontekstu oraz dostęp spoza kontekstu.
    if (f && t && f.ctx === t.ctx && f.layer !== t.layer) {
      const ok =
        LAYER_ALLOWED[f.layer]?.includes(t.layer) ||
        (f.layer === "schemas" && t.layer === "models" && e.typeOnly);
      if (!ok) add(e, 3);
    }
    // Spoza kontekstu: `repositories`/`models` nigdy; `services` tylko ze starego `services/**`
    // (z `src/` pilnuje R1, z `types/` R9, z innych kontekstów R2).
    if (t && !(f && f.ctx === t.ctx) && !within(e.from, "src") && !within(e.from, "types")) {
      if (t.layer === "repositories" || t.layer === "models") add(e, 3);
      if (t.layer === "services" && !f && !within(e.from, "services")) add(e, 3);
    }
    // `schemas` bezpieczne dla klienta: tylko `lib/schema/**` i `import type` z własnego `models`.
    if (f?.layer === "schemas") {
      const ownModels = t && t.ctx === f.ctx && t.layer === "models" && e.typeOnly;
      const sameFolder = t && t.ctx === f.ctx && t.layer === "schemas";
      if (!within(e.to, "lib/schema") && !ownModels && !sameFolder) add(e, 3);
    }

    // R4: router dostępny tylko z tras `app/api/.../route` (i z własnego folderu `router/`).
    if (
      t?.layer === "router" &&
      !isRoute(e.from) &&
      !(f && f.ctx === t.ctx && f.layer === "router")
    ) {
      add(e, 4);
    }

    // R5: `lib/nexus/**` tylko z repozytoriów kontekstów i wyjątków przejściowych (z `src/` pilnuje R1).
    if (within(e.to, "lib/nexus") && !within(e.from, "src")) {
      const allowed =
        f?.layer === "repositories" ||
        within(e.from, "lib/nexus") ||
        (e.from === "lib/workGuard" &&
          (e.to === "lib/nexus/vault-path" || (e.to === "lib/nexus/vault-fs" && e.typeOnly))) ||
        (e.from === "lib/firestore-db" && within(e.to, "lib/nexus/repos"));
      if (!allowed) add(e, 5);
    }

    // R6: backend nie importuje UI.
    if (
      (within(e.from, "app/api") ||
        within(e.from, "services") ||
        within(e.from, "lib") ||
        within(e.from, "contexts") ||
        within(e.from, "types")) &&
      within(e.to, "src")
    ) {
      add(e, 6);
    }

    // R7: konteksty nie sięgają do starych `services/**`, `types/records` ani `lib/firestore-db`.
    if (
      f &&
      (within(e.to, "services") || e.to === "types/records" || e.to === "lib/firestore-db")
    ) {
      add(e, 7);
    }

    // R9: `types/records` nie zależy od kontekstów (poza `schemas`).
    if (e.from === "types/records" && t && t.layer !== "schemas") add(e, 9);
  }

  // R4 (treść tras): trasa z krawędzią do `contexts/**` to jeden re-eksport routera.
  for (const [route, content] of routeFiles) {
    if (!edges.some((e) => e.from === route && within(e.to, "contexts"))) continue;
    let reexports = 0;
    for (const imp of extractImports(content)) {
      if (ROUTE_REEXPORT.test(imp.statement) && ++reexports === 1) continue;
      out.add(`${route} → ${imp.specifier} (reguła 4)`);
    }
  }

  // R8: brak cykli między `services` kontekstów (węzeł = kontekst).
  const graph = new Map<string, Set<string>>();
  for (const e of edges) {
    const f = ctxInfo(e.from);
    const t = ctxInfo(e.to);
    if (f?.layer === "services" && t?.layer === "services" && f.ctx !== t.ctx) {
      if (!graph.has(f.ctx)) graph.set(f.ctx, new Set());
      graph.get(f.ctx)!.add(t.ctx);
    }
  }
  const seenCycles = new Set<string>();
  const nodeName = (ctx: string) => `contexts/${ctx}/services`;
  const walk = (node: string, stack: string[]) => {
    const at = stack.indexOf(node);
    if (at >= 0) {
      const cycle = stack.slice(at);
      const min = cycle.reduce((a, b) => (b < a ? b : a));
      const start = cycle.indexOf(min);
      const rotated = [...cycle.slice(start), ...cycle.slice(0, start)];
      seenCycles.add([...rotated, rotated[0]].map(nodeName).join(" → "));
      return;
    }
    for (const next of [...(graph.get(node) ?? [])].sort()) walk(next, [...stack, node]);
  };
  for (const start of [...graph.keys()].sort()) walk(start, []);
  for (const c of seenCycles) out.add(`cykl: ${c} (reguła 8)`);

  return [...out].sort();
}

// ─── część A: reguły na danych testowych ─────────────────────────────────────

const e = (from: string, to: string, typeOnly = false): Edge => ({ from, to, typeOnly });
const none = new Map<string, string>();
const rule = (from: string, to: string, n: number) => `${from} → ${to} (reguła ${n})`;

describe("reguły na danych testowych", () => {
  describe("normalize", () => {
    it("n1: ścieżka względna z .js", () => {
      expect(normalize("src/a/B.tsx", "../../lib/nexus/vault-fs.js")).toBe("lib/nexus/vault-fs");
    });
    it("n2: alias @/ do katalogu z index", () => {
      expect(normalize("app/api/x/route.ts", "@/contexts/bc_p/router")).toBe(
        "contexts/bc_p/router"
      );
      expect(normalize("app/api/x/route.ts", "@/contexts/bc_p/router/index")).toBe(
        "contexts/bc_p/router"
      );
    });
    it("n3: pakiety to null", () => {
      expect(normalize("lib/a.ts", "zod")).toBeNull();
      expect(normalize("lib/a.ts", "node:fs")).toBeNull();
      expect(normalize("lib/a.ts", "next/server")).toBeNull();
    });
    it("ścieżka pliku źródłowego: ucina rozszerzenie i /index", () => {
      expect(normalizePath("app/api/p/route.ts")).toBe("app/api/p/route");
      expect(normalizePath("contexts/bc_a/repositories/index.ts")).toBe(
        "contexts/bc_a/repositories"
      );
    });
    it("ucina też .mjs/.cjs/.mts/.cts", () => {
      expect(normalize("lib/a.ts", "./models.mjs")).toBe("lib/models");
      expect(normalize("lib/a.ts", "./models.cts")).toBe("lib/models");
    });
    it("css i inne pliki zachowują rozszerzenie", () => {
      expect(normalize("src/features/p/V.tsx", "./projects.css")).toBe(
        "src/features/p/projects.css"
      );
    });
  });

  describe("extractImports", () => {
    it("e1: export type nie skleja się z następnym importem", () => {
      const r = extractImports('export type A = { a: 1 };\nimport { b } from "./models";');
      expect(r.map((x) => [x.specifier, x.typeOnly])).toEqual([["./models", false]]);
    });
    it("e2: export const ze stringiem nie skleja się z następnym importem", () => {
      const r = extractImports('export const s = "x";\nimport type { T } from "./m";');
      expect(r.map((x) => [x.specifier, x.typeOnly])).toEqual([["./m", true]]);
    });
    it("e3: import wieloliniowy", () => {
      const r = extractImports('import {\n  a,\n  b\n} from "@/lib/x";');
      expect(r.map((x) => x.specifier)).toEqual(["@/lib/x"]);
    });
    it("e4: import w komentarzu pomijany", () => {
      expect(extractImports('// import x from "y"\n/* import z from "w" */')).toEqual([]);
    });
    it("re-eksport, import dynamiczny, require, side-effect", () => {
      const r = extractImports(
        'export { a as GET } from "@/x/router";\nexport * from "./all";\nimport "./side";\nconst m = import("./dyn");\nconst r = require("./req");'
      );
      expect(r.map((x) => x.specifier).sort()).toEqual(
        ["./all", "./dyn", "./req", "./side", "@/x/router"].sort()
      );
    });
    it("import dynamiczny i require z template literal bez interpolacji", () => {
      const r = extractImports(
        "const a = import(`@/lib/nexus/vault-fs`);\nconst b = require(`./x`);"
      );
      expect(r.map((x) => x.specifier)).toEqual(["@/lib/nexus/vault-fs", "./x"]);
    });
    it("template literal z interpolacją jest pomijany (ścieżka nieznana statycznie)", () => {
      expect(extractImports("const a = import(`./x/${name}`);")).toEqual([]);
    });
    it("import { type X } liczy się jako runtime", () => {
      const r = extractImports('import { type X } from "./m";');
      expect(r[0].typeOnly).toBe(false);
    });
  });

  describe("violations", () => {
    const cases: [string, Edge[], string[]][] = [
      [
        "r1: UI → services kontekstu",
        [e("src/features/x/A", "contexts/bc_p/services")],
        [rule("src/features/x/A", "contexts/bc_p/services", 1)],
      ],
      ["r1b: UI → schemas kontekstu", [e("src/features/x/A", "contexts/bc_p/schemas")], []],
      [
        "r1c: UI → http, services, lib/nexus",
        [
          e("src/features/x/A", "lib/http/apiError"),
          e("src/features/x/A", "services/x"),
          e("src/features/x/A", "lib/nexus/vault-fs"),
        ],
        [
          rule("src/features/x/A", "lib/http/apiError", 1),
          rule("src/features/x/A", "lib/nexus/vault-fs", 1),
          rule("src/features/x/A", "services/x", 1),
        ],
      ],
      [
        "r2: services → cudze repositories",
        [e("contexts/bc_a/services", "contexts/bc_b/repositories")],
        [
          rule("contexts/bc_a/services", "contexts/bc_b/repositories", 2),
          rule("contexts/bc_a/services", "contexts/bc_b/repositories", 3),
        ],
      ],
      [
        "r2b: services → cudze services",
        [e("contexts/bc_a/services", "contexts/bc_b/services")],
        [],
      ],
      [
        "r2c: router → cudze services",
        [e("contexts/bc_a/router", "contexts/bc_b/services")],
        [rule("contexts/bc_a/router", "contexts/bc_b/services", 2)],
      ],
      [
        "r2d: lib → services kontekstu",
        [e("lib/x", "contexts/bc_a/services")],
        [rule("lib/x", "contexts/bc_a/services", 3)],
      ],
      [
        "r2e: router → infrastruktura spoza kontekstu",
        [e("contexts/bc_a/router", "lib/http/apiError"), e("contexts/bc_a/router", "lib/errors")],
        [],
      ],
      [
        "r3: repositories → services",
        [e("contexts/bc_a/repositories", "contexts/bc_a/services")],
        [rule("contexts/bc_a/repositories", "contexts/bc_a/services", 3)],
      ],
      [
        "r3b: wnętrze folderu repositories",
        [e("contexts/bc_a/repositories", "contexts/bc_a/repositories/markdown")],
        [],
      ],
      [
        "r3c: schemas → models bez import type",
        [e("contexts/bc_a/schemas", "contexts/bc_a/models")],
        [rule("contexts/bc_a/schemas", "contexts/bc_a/models", 3)],
      ],
      [
        "r3d: schemas → models z import type",
        [e("contexts/bc_a/schemas", "contexts/bc_a/models", true)],
        [],
      ],
      [
        "r3e: router → repositories",
        [e("contexts/bc_a/router", "contexts/bc_a/repositories")],
        [rule("contexts/bc_a/router", "contexts/bc_a/repositories", 3)],
      ],
      [
        "r3f: models → schemas",
        [e("contexts/bc_a/models", "contexts/bc_a/schemas")],
        [rule("contexts/bc_a/models", "contexts/bc_a/schemas", 3)],
      ],
      [
        "r3g: schemas → lib/http",
        [e("contexts/bc_a/schemas", "lib/http/apiError")],
        [rule("contexts/bc_a/schemas", "lib/http/apiError", 3)],
      ],
      ["r3h: schemas → lib/schema", [e("contexts/bc_a/schemas", "lib/schema/looseObject")], []],
      [
        "r4: services → router",
        [e("services/x", "contexts/bc_a/router")],
        [rule("services/x", "contexts/bc_a/router", 4)],
      ],
      [
        "r5: services → lib/nexus/vault-fs",
        [e("services/x", "lib/nexus/vault-fs")],
        [rule("services/x", "lib/nexus/vault-fs", 5)],
      ],
      ["r5b: workGuard → vault-path", [e("lib/workGuard", "lib/nexus/vault-path")], []],
      [
        "r5e: workGuard → vault-fs bez import type",
        [e("lib/workGuard", "lib/nexus/vault-fs")],
        [rule("lib/workGuard", "lib/nexus/vault-fs", 5)],
      ],
      ["r5c: repositories → vault-fs", [e("contexts/bc_a/repositories", "lib/nexus/vault-fs")], []],
      ["r5d: firestore-db → lib/nexus/repos", [e("lib/firestore-db", "lib/nexus/repos/tags")], []],
      ["r6: lib → src", [e("lib/x", "src/features/y")], [rule("lib/x", "src/features/y", 6)]],
      ["r6b: app/layout → src", [e("app/layout", "src/components/theme/ThemeScript")], []],
      [
        "r7: kontekst → firestore-db",
        [e("contexts/bc_a/services", "lib/firestore-db")],
        [rule("contexts/bc_a/services", "lib/firestore-db", 7)],
      ],
      [
        "r7b: stary serwis → kontekst",
        [e("services/calendarService", "contexts/bc_a/services")],
        [],
      ],
      [
        "r8: cykl services",
        [
          e("contexts/bc_a/services", "contexts/bc_b/services"),
          e("contexts/bc_b/services", "contexts/bc_a/services"),
        ],
        [
          "cykl: contexts/bc_a/services → contexts/bc_b/services → contexts/bc_a/services (reguła 8)",
        ],
      ],
      [
        "r9: types/records → models",
        [e("types/records", "contexts/bc_a/models")],
        [rule("types/records", "contexts/bc_a/models", 9)],
      ],
      ["r9b: types/records → schemas", [e("types/records", "contexts/bc_a/schemas")], []],
    ];
    for (const [name, edges, expected] of cases) {
      it(name, () => {
        expect(violations(edges, none)).toEqual(expected);
      });
    }

    const edge = [e("app/api/p/route", "contexts/bc_a/router")];
    it("r4b: trasa z dodatkowym importem", () => {
      const routes = new Map([
        [
          "app/api/p/route",
          'export { list as GET } from "@/contexts/bc_a/router";\nimport x from "zod";',
        ],
      ]);
      expect(violations(edge, routes)).toEqual(["app/api/p/route → zod (reguła 4)"]);
    });
    it("r4c: trasa to sam re-eksport", () => {
      const routes = new Map([
        ["app/api/p/route", 'export { list as GET } from "@/contexts/bc_a/router";'],
      ]);
      expect(violations(edge, routes)).toEqual([]);
    });
    it("r4d: import zamiast re-eksportu", () => {
      const routes = new Map([
        [
          "app/api/p/route",
          'import { list } from "@/contexts/bc_a/router";\nexport const GET = list;',
        ],
      ]);
      expect(violations(edge, routes)).toEqual([
        "app/api/p/route → @/contexts/bc_a/router (reguła 4)",
      ]);
    });
    it("r4e: re-eksport z podpliku router/ i z rozszerzeniem jest dozwolony", () => {
      for (const spec of ["@/contexts/bc_a/router/index.js", "@/contexts/bc_a/router/list"]) {
        const routes = new Map([["app/api/p/route", `export { list as GET } from "${spec}";`]]);
        expect(violations(edge, routes)).toEqual([]);
      }
    });
    it("kontekst bez prefiksu bc_ też podlega regułom", () => {
      expect(violations([e("contexts/foo/router", "contexts/foo/repositories")], none)).toEqual([
        rule("contexts/foo/router", "contexts/foo/repositories", 3),
      ]);
    });
    it("trasa bez krawędzi do contexts/ nie podlega kontroli treści (stare trasy)", () => {
      const routes = new Map([["app/api/old/route", 'import { x } from "zod";']]);
      expect(violations([e("app/api/old/route", "services/x")], routes)).toEqual([]);
    });
  });
});

// ─── część B: skan prawdziwego repo ──────────────────────────────────────────

const ROOT = process.cwd();
const SCAN = ["app", "contexts", "lib", "services", "src", "types"]; // + plik middleware.ts
/** Znane wyjątki (spec struktury §6); lista może tylko maleć. Klucz = `from → to` bez numeru reguły. */
const BASELINE: readonly string[] = [
  "services/boardService → src/features/board/boardTypes",
  "services/boardService → src/features/board/boardSchema",
  "services/mindMapService → src/features/mind-maps/mindMapTypes",
  "app/api/board/route → src/features/board/boardSchema",
  "app/api/mind-maps/[id]/route → src/features/mind-maps/mindMapTypes",
];

function scanFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) return; // np. contexts/ przed pierwszym kontekstem
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry.name)) files.push(rel);
    }
  };
  for (const dir of SCAN) walk(dir);
  if (fs.existsSync(path.join(ROOT, "middleware.ts"))) files.push("middleware.ts");
  return files.sort();
}

function loadRepo() {
  const files = scanFiles();
  const edges: Edge[] = [];
  const routeFiles = new Map<string, string>();
  for (const file of files) {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    const from = normalizePath(file);
    if (isRoute(from)) routeFiles.set(from, text);
    for (const imp of extractImports(text)) {
      const to = normalize(file, imp.specifier);
      if (to !== null) edges.push({ from, to, typeOnly: imp.typeOnly });
    }
  }
  return { files, edges, routeFiles };
}

const keyOf = (violation: string) => violation.replace(/ \(reguła \d+\)$/, "");

describe("repo", () => {
  const { files, edges, routeFiles } = loadRepo();
  const found = violations(edges, routeFiles);

  it("skanuje kod źródłowy", () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain("middleware.ts");
    expect(files).toContain("lib/http/apiError.ts");
  });

  it("brak naruszeń poza baseline", () => {
    expect(found.filter((v) => !BASELINE.includes(keyOf(v)))).toEqual([]);
  });

  it("każdy wyjątek z baseline nadal występuje", () => {
    const keys = new Set(found.map(keyOf));
    expect(BASELINE.filter((b) => !keys.has(b))).toEqual([]);
  });
});
