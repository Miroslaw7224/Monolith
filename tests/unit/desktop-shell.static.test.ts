// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("Monolith jako aplikacja z pulpitu", () => {
  const app = read("src/App.tsx");

  it.each(["ProjectsView", "MapView", "CodexView", "PlanowanieView"])(
    "%s ładuje się leniwie (next/dynamic), bez statycznego importu",
    (name) => {
      expect(app).not.toMatch(new RegExp(`^import[^\\n]*\\b${name}\\b[^\\n]*from`, "m"));
      expect(app).toMatch(new RegExp(`const ${name} = dynamic\\(`));
    }
  );

  it("HomeView zostaje importowany statycznie (Kokpit startuje bez dodatkowego chunka)", () => {
    expect(app).toMatch(/^import HomeView from/m);
  });

  it('tytuł okna to dokładnie "Monolith"', () => {
    expect(read("app/layout.tsx")).toMatch(/title:\s*"Monolith"/);
  });
});
