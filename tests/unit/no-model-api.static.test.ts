// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "src", "services", "lib", "scripts", "contexts"];
const SKIP_DIRS = new Set(["node_modules", ".next"]);
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

// Klucze, SDK, trasy i moduły modeli po API. Wzorzec jest celowo szeroki.
const FORBIDDEN =
  /@google\/genai|GoogleGenAI|GEMINI_API_KEY|OLLAMA_|ollama|\/api\/agent|\/api\/plan\/ask|mind-maps\/(?:ai-node|import)|lib\/gemini|services\/(?:agentService|planService|mindMapAIService)/i;

function walk(dir: string, out: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(rel, out);
    } else if (SOURCE_EXT.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

const FILES = SCAN_DIRS.flatMap((d) => walk(d));

describe("no model APIs in the app", () => {
  it("scans a realistic number of source files", () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it("has no source file referencing a model API, SDK, key or AI route", () => {
    const hits: string[] = [];
    for (const rel of FILES) {
      const lines = fs.readFileSync(path.join(ROOT, rel), "utf8").split("\n");
      lines.forEach((line, i) => {
        const m = line.match(FORBIDDEN);
        if (m) hits.push(`${rel}:${i + 1} (${m[0]})`);
      });
    }
    expect(hits).toEqual([]);
  });

  it("does not depend on @google/genai", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(all).filter((n) => /genai|ollama|openai|anthropic/i.test(n))).toEqual([]);
  });

  it(".env.example mentions no model keys", () => {
    const env = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
    expect(env).not.toMatch(/GEMINI|OLLAMA|OPENAI|ANTHROPIC/i);
  });
});
