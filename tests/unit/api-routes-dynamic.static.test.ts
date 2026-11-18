// @vitest-environment node
/**
 * Strażnik: trasa GET bez argumentów (handler nie czyta żądania), która nie eksportuje też POST,
 * DELETE, PATCH ani OPTIONS, jest w buildzie produkcyjnym Next 14 prerenderowana, więc ikona
 * z pulpitu pokazuje stan vaulta z chwili builda. Taka trasa musi mieć
 * `export const dynamic = "force-dynamic"`. Handlery z parametrem (np. `request`) oraz trasy
 * z metodą mutującą Next robi dynamicznymi sam, dlatego ich nie sprawdzamy
 * (`hasNonStaticMethods` w next/dist/server/future/route-modules/app-route/module.js).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return routeFiles(full);
    return e.name === "route.ts" ? [full] : [];
  });
}

/** Nazwa funkcji wyeksportowanej jako GET z `router.ts` albo `null`, gdy GET jest zdefiniowany w trasie. */
function getHandlerName(src: string): { name: string; from: string } | null {
  const m = src.match(/export\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g);
  for (const stmt of m ?? []) {
    const parts = stmt.match(/export\s*\{([^}]*)\}\s*from\s*"([^"]+)"/);
    if (!parts) continue;
    for (const item of parts[1].split(",")) {
      const [orig, alias] = item.trim().split(/\s+as\s+/);
      if ((alias ?? orig) === "GET") return { name: orig, from: parts[2] };
    }
  }
  return null;
}

/** Czy handler `name` w pliku `src` nie ma żadnych parametrów. */
function takesNoArgs(src: string, name: string): boolean {
  const fn = new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\s*\\(\\s*\\)`);
  const arrow = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*(?:async\\s*)?\\(\\s*\\)`);
  return fn.test(src) || arrow.test(src);
}

describe("trasy GET bez argumentów są force-dynamic", () => {
  const files = routeFiles(path.join(ROOT, "app/api"));

  it("znajduje trasy", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("każda trasa GET bez argumentów ma force-dynamic", () => {
    const missing: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      let noArgs = false;
      const ref = getHandlerName(src);
      if (ref !== null && ref.from.startsWith("@/")) {
        const routerPath = path.join(ROOT, ref.from.slice(2));
        const candidates = [`${routerPath}.ts`, path.join(routerPath, "index.ts")];
        const routerFile = candidates.find((c) => fs.existsSync(c));
        if (routerFile) noArgs = takesNoArgs(fs.readFileSync(routerFile, "utf8"), ref.name);
      } else if (/export\s+(?:async\s+)?function\s+GET\s*\(\s*\)/.test(src)) {
        noArgs = true;
      }
      const hasMutation = /\b(?:POST|DELETE|PATCH|OPTIONS)\b/.test(src);
      if (noArgs && !hasMutation && !/export\s+const\s+dynamic\s*=\s*"force-dynamic"/.test(src)) {
        missing.push(path.relative(ROOT, file));
      }
    }
    expect(missing).toEqual([]);
  });
});
