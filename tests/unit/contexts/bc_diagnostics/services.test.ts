// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceEntry, SourceRead } from "@/contexts/bc_diagnostics/models";
import type * as ProjectsServices from "@/contexts/bc_projects/services";
import type * as DiagnosticsRepo from "@/contexts/bc_diagnostics/repositories";

const mockWsl = vi.hoisted(() => vi.fn<typeof DiagnosticsRepo.readWsl>());
const mockWin = vi.hoisted(() => vi.fn<typeof DiagnosticsRepo.readWindows>());
const mockSubdirs = vi.hoisted(() => vi.fn<typeof DiagnosticsRepo.readSubdirs>());
const mockProjects = vi.hoisted(() => vi.fn<typeof ProjectsServices.listProjects>());

vi.mock("@/contexts/bc_projects/services", async (importOriginal) => {
  const actual = await importOriginal<typeof ProjectsServices>();
  return {
    listProjects: mockProjects,
    isWorkProject: actual.isWorkProject,
  } satisfies Partial<typeof ProjectsServices>;
});

vi.mock(
  "@/contexts/bc_diagnostics/repositories",
  () =>
    ({
      readWsl: mockWsl,
      readWindows: mockWin,
      readSubdirs: mockSubdirs,
    }) satisfies Partial<typeof DiagnosticsRepo>
);

import {
  buildKillCommand,
  classifyExposure,
  isDevProcess,
  listPorts,
  redactCommand,
} from "@/contexts/bc_diagnostics/services";

const entry = (o: Partial<SourceEntry> = {}): SourceEntry => ({
  source: "wsl",
  port: 3000,
  address: "127.0.0.1",
  pid: 100,
  process: "node",
  path: null,
  commandLine: null,
  cwd: null,
  ancestors: [],
  ...o,
});
type P = ReturnType<typeof ProjectsServices.listProjects>["projects"][number];
const project = (id: string, localPath: string, owner: "personal" | "work" = "personal"): P => ({
  id,
  name: id.toUpperCase(),
  status: "active",
  priority: "medium",
  folder: `Projects/${id}/`,
  localPath,
  owner,
  whereIStopped: null,
  freshness: "fresh",
});
const ok = (...entries: SourceEntry[]): SourceRead => ({ ok: true, entries });
const NOW = () => new Date("2026-11-17T10:00:00.000Z");

beforeEach(() => {
  mockWsl.mockReset().mockResolvedValue(ok());
  mockWin.mockReset().mockResolvedValue(ok());
  mockProjects.mockReset().mockReturnValue({ projects: [], warnings: [] });
  mockSubdirs.mockReset().mockResolvedValue([]);
});

describe("classifyExposure", () => {
  it.each(["127.0.0.1", "127.0.0.53", "::1", "::ffff:127.0.0.1"])("%s to local", (a) => {
    expect(classifyExposure(a)).toBe("local");
  });
  it.each(["0.0.0.0", "::", "*", "10.255.255.254", "192.168.1.5"])("%s to network", (a) => {
    expect(classifyExposure(a)).toBe("network");
  });
});

describe("isDevProcess", () => {
  it.each([
    "node",
    "next-server (v1",
    "python3.12",
    "vite",
    "postgres",
    "docker-proxy",
    "com.docker.backend",
    "Redis-Server",
    "dotnet",
    "java",
    "nginx",
  ])("%s to proces dev", (name) => {
    expect(isDevProcess(name)).toBe(true);
  });
  it.each([
    "agy",
    "Discord",
    "steam",
    "GoogleDriveFS",
    "spoolsv",
    "msedgewebview2",
    "",
    "jhi_service",
  ])("%s nie jest procesem dev", (name) => {
    expect(isDevProcess(name)).toBe(false);
  });
});

describe("buildKillCommand", () => {
  it("składa komendę wyłącznie z PID", () => {
    expect(buildKillCommand("wsl", 2562323)).toBe("kill 2562323");
    expect(buildKillCommand("windows", 2562323)).toBe("Stop-Process -Id 2562323");
  });
  it.each([null, 0, -5, 1.5, Number.NaN])("PID %s daje null", (pid) => {
    expect(buildKillCommand("wsl", pid)).toBeNull();
  });
});

describe("redactCommand", () => {
  it("maskuje tokeny, hasła i sekrety", () => {
    expect(redactCommand("node app.js --token=abc123 --port 80")).toBe(
      "node app.js --token=*** --port 80"
    );
    expect(redactCommand("x --password=p --secret=s --api-key=k")).toBe(
      "x --password=*** --secret=*** --api-key=***"
    );
    expect(redactCommand("API_TOKEN=abc DB_PASSWORD=zzz node a.js")).toBe(
      "API_TOKEN=*** DB_PASSWORD=*** node a.js"
    );
  });
  it("maskuje flagi z wartością po spacji (cmdline z /proc jest łączony spacją)", () => {
    expect(redactCommand("srv --token abc --port 80")).toBe("srv --token *** --port 80");
    expect(redactCommand("srv --password hunter2 --pwd x --auth y")).toBe(
      "srv --password *** --pwd *** --auth ***"
    );
  });
  it("maskuje flagi złożone (--auth-token, --access-token)", () => {
    expect(redactCommand("srv --auth-token=abc --access-token xyz --port 80")).toBe(
      "srv --auth-token=*** --access-token *** --port 80"
    );
  });
  it("nie zjada kolejnej flagi ani zwykłych portów", () => {
    expect(redactCommand("srv --password --port 80")).toBe("srv --password --port 80");
    expect(redactCommand("srv -p 3000 --port 3000 --passport x")).toBe(
      "srv -p 3000 --port 3000 --passport x"
    );
  });
  it("maskuje zmienne *KEY= i sekrety w query URL", () => {
    expect(redactCommand("API_KEY=abc node a.js")).toBe("API_KEY=*** node a.js");
    expect(redactCommand("curl https://h/x?api_key=abc&a=1&token=t")).toBe(
      "curl https://h/x?api_key=***&a=1&token=***"
    );
  });
  it("maskuje hasło w URL bez loginu", () => {
    expect(redactCommand("redis://:haslo@host:6379")).toBe("redis://:***@host:6379");
  });
  it("maskuje hasło w URL", () => {
    expect(redactCommand("x postgres://user:haslo@host/db")).toBe("x postgres://user:***@host/db");
  });
  it("ucina do 200 znaków po redakcji", () => {
    expect(redactCommand("a".repeat(500))).toHaveLength(200);
  });
  it("null zostaje null", () => {
    expect(redactCommand(null)).toBeNull();
  });
});

describe("listPorts", () => {
  it("awaria Windows nie psuje listy WSL", async () => {
    mockWsl.mockResolvedValue(ok(entry()));
    mockWin.mockResolvedValue({ ok: false, reason: "missing" });
    const r = await listPorts({ now: NOW });
    expect(r.ports).toHaveLength(1);
    expect(r.sources).toEqual({ wsl: { ok: true }, windows: { ok: false, reason: "missing" } });
    expect(r.generatedAt).toBe("2026-11-17T10:00:00.000Z");
  });

  it("odrzucona obietnica źródła to reason error", async () => {
    mockWsl.mockRejectedValue(new Error("boom"));
    const r = await listPorts({ now: NOW });
    expect(r.sources.wsl).toEqual({ ok: false, reason: "error" });
  });

  it("ten sam port z różnymi PID w WSL i Windows to dwa wiersze", async () => {
    mockWsl.mockResolvedValue(ok(entry({ pid: 1 })));
    mockWin.mockResolvedValue(ok(entry({ source: "windows", pid: 2 })));
    expect((await listPorts({ now: NOW })).ports).toHaveLength(2);
  });

  it("scala adresy tego samego procesu i portu w jeden wiersz (IPv4 + IPv6), bez powtórek", async () => {
    mockWin.mockResolvedValue(
      ok(
        entry({ source: "windows", process: "postgres", pid: 8, port: 5398, address: "::" }),
        entry({ source: "windows", process: "postgres", pid: 8, port: 5398, address: "0.0.0.0" }),
        entry({ source: "windows", process: "postgres", pid: 8, port: 5398, address: "0.0.0.0" })
      )
    );
    const { ports } = await listPorts({ now: NOW });
    expect(ports).toHaveLength(1);
    expect(ports[0].addresses).toEqual(["0.0.0.0", "::"]);
    expect(ports[0].exposure).toBe("network");
  });

  it("wiersz jest lokalny tylko wtedy, gdy wszystkie adresy są lokalne", async () => {
    mockWsl.mockResolvedValue(
      ok(
        entry({ address: "127.0.0.1" }),
        entry({ address: "::1" }),
        entry({ port: 81, address: "127.0.0.1" }),
        entry({ port: 81, address: "0.0.0.0" })
      )
    );
    const { ports } = await listPorts({ now: NOW });
    expect(ports.find((p) => p.port === 3000)?.exposure).toBe("local");
    expect(ports.find((p) => p.port === 81)?.exposure).toBe("network");
  });

  it("różne PID na tym samym porcie nie są scalane", async () => {
    mockWsl.mockResolvedValue(ok(entry({ pid: 1 }), entry({ pid: 2 })));
    expect((await listPorts({ now: NOW })).ports).toHaveLength(2);
  });

  it("sortuje po porcie, potem źródle (wsl przed windows)", async () => {
    mockWsl.mockResolvedValue(ok(entry({ port: 8080 }), entry({ port: 22 })));
    mockWin.mockResolvedValue(ok(entry({ source: "windows", port: 22, pid: 9 })));
    const r = await listPorts({ now: NOW });
    expect(r.ports.map((p) => `${p.port}/${p.source}`)).toEqual([
      "22/wsl",
      "22/windows",
      "8080/wsl",
    ]);
  });

  it("PID serwera Monolith w WSL to self; ten sam numer w Windows to null", async () => {
    mockWsl.mockResolvedValue(ok(entry({ pid: 777, port: 3100 })));
    mockWin.mockResolvedValue(ok(entry({ source: "windows", pid: 777, port: 3101 })));
    const r = await listPorts({ selfPid: 777, now: NOW });
    expect(r.ports.find((p) => p.source === "wsl")?.warning).toBe("self");
    expect(r.ports.find((p) => p.source === "windows")?.warning).toBeNull();
  });

  it("pomija procesy systemowe Windows (bez rozróżniania wielkości liter)", async () => {
    mockWin.mockResolvedValue(
      ok(
        ...["System", "LSASS", "services", "wininit", "svchost", "csrss", "smss"].map(
          (process, i) => entry({ source: "windows", process, pid: i + 1, port: 100 + i })
        ),
        entry({ source: "windows", process: "Discord", pid: 99, port: 6463 })
      )
    );
    const r = await listPorts({ now: NOW });
    expect(r.ports.map((p) => p.process)).toEqual(["Discord"]);
  });

  it("proces o nazwie systemowej w WSL nie jest pomijany", async () => {
    mockWsl.mockResolvedValue(ok(entry({ process: "svchost", pid: 7 })));
    expect((await listPorts({ now: NOW })).ports).toHaveLength(1);
  });

  it("relevant: procesy dev, serwer Monolith i nienazwane porty ≥1024; reszta nie", async () => {
    mockWsl.mockResolvedValue(
      ok(
        entry({ port: 5173, process: "node", pid: 1 }),
        entry({ port: 3101, process: "next-server (v1", pid: 2 }),
        entry({ port: 44773, process: "agy", pid: 3 }),
        entry({ port: 22, process: "", pid: null }),
        entry({ port: 53, process: "", pid: null, address: "127.0.0.53" }),
        entry({ port: 5434, process: "", pid: null, address: "*" })
      )
    );
    mockWin.mockResolvedValue(
      ok(
        entry({ source: "windows", port: 5398, process: "postgres", pid: 8 }),
        entry({ source: "windows", port: 6463, process: "Discord", pid: 9 })
      )
    );
    const { ports } = await listPorts({ now: NOW });
    const rel = Object.fromEntries(ports.map((p) => [`${p.source}:${p.port}`, p.relevant]));
    expect(rel).toEqual({
      "wsl:22": false,
      "wsl:53": false,
      "wsl:3101": true,
      "wsl:5173": true,
      "wsl:5434": true,
      "wsl:44773": false,
      "windows:5398": true,
      "windows:6463": false,
    });
  });

  it("własny serwer Monolith jest zawsze relevant", async () => {
    mockWsl.mockResolvedValue(ok(entry({ pid: 777, process: "agy", port: 3100 })));
    expect((await listPorts({ selfPid: 777, now: NOW })).ports[0].relevant).toBe(true);
  });

  describe("projekt procesu (po cwd)", () => {
    const HOME = "/home/u";
    const withProjects = (...ps: ReturnType<typeof project>[]) =>
      mockProjects.mockReturnValue({ projects: ps, warnings: [] });
    const one = async (cwd: string | null) => {
      mockWsl.mockResolvedValue(ok(entry({ cwd })));
      return (await listPorts({ now: NOW, home: HOME })).ports[0].project;
    };

    it("dopasowuje podkatalog projektu (frontend/backend) i sam katalog główny", async () => {
      withProjects(project("tester-ai", "/home/u/projects/crait/projects/TesterAI"));
      const expected = { id: "tester-ai", name: "TESTER-AI" };
      expect(await one("/home/u/projects/crait/projects/TesterAI/frontend")).toEqual(expected);
      expect(await one("/home/u/projects/crait/projects/TesterAI")).toEqual(expected);
    });

    it("rozwija ~ w localPath", async () => {
      withProjects(project("mono", "~/projects/Monolith"));
      expect(await one("/home/u/projects/Monolith")).toEqual({ id: "mono", name: "MONO" });
    });

    it("nie dopasowuje na granicy innej niż segment ścieżki", async () => {
      withProjects(project("tester-ai", "/home/u/TesterAI"));
      expect(await one("/home/u/TesterAI-old")).toBeNull();
    });

    it("wygrywa najdłuższy prefiks (projekt zagnieżdżony)", async () => {
      withProjects(project("a", "/home/u/p"), project("b", "/home/u/p/sub"));
      expect(await one("/home/u/p/sub/x")).toEqual({ id: "b", name: "B" });
    });

    it("worktree produkcyjny <katalog>-prod należy do tego samego projektu", async () => {
      withProjects(project("mono", "/home/u/Monolith"));
      const expected = { id: "mono", name: "MONO" };
      expect(await one("/home/u/Monolith-prod")).toEqual(expected);
      expect(await one("/home/u/Monolith-prod/.next")).toEqual(expected);
      expect(await one("/home/u/Monolith-production")).toBeNull();
    });

    it("projekt etatowy (work) i brak cwd dają null", async () => {
      withProjects(project("firma", "/home/u/firma", "work"));
      expect(await one("/home/u/firma/app")).toBeNull();
      expect(await one(null)).toBeNull();
    });

    it("błąd odczytu projektów nie psuje listy portów", async () => {
      mockProjects.mockImplementation(() => {
        throw new Error("vault");
      });
      mockWsl.mockResolvedValue(ok(entry({ cwd: "/home/u/x" })));
      const { ports } = await listPorts({ now: NOW, home: HOME });
      expect(ports).toHaveLength(1);
      expect(ports[0].project).toBeNull();
    });

    it("wiersze Windows (bez cwd) nie mają projektu", async () => {
      withProjects(project("a", "/home/u"));
      mockWin.mockResolvedValue(ok(entry({ source: "windows", process: "postgres" })));
      expect((await listPorts({ now: NOW, home: HOME })).ports[0].project).toBeNull();
    });
  });

  describe("rola, sierota, wspólny rodzic i brakująca rola", () => {
    const HOME = "/home/u";
    const ROOT = "/home/u/projects/TesterAI";
    const withProject = () =>
      mockProjects.mockReturnValue({ projects: [project("tester-ai", ROOT)], warnings: [] });
    const run = async (...entries: SourceEntry[]) => {
      mockWsl.mockResolvedValue(ok(...entries));
      return listPorts({ now: NOW, home: HOME });
    };
    const at = (sub: string, o: Partial<SourceEntry> = {}) =>
      entry({ cwd: sub === "" ? ROOT : `${ROOT}/${sub}`, ...o });

    it("id wiersza to źródło|PID|port", async () => {
      const { ports } = await run(entry({ pid: 7, port: 81 }));
      expect(ports[0].id).toBe("wsl|7|81");
    });

    it.each([
      ["frontend", "frontend"],
      ["client/src", "frontend"],
      ["backend", "backend"],
      ["server", "backend"],
      ["docs", null],
      ["", null],
    ])("rola z katalogu: %s → %s", async (sub, role) => {
      withProject();
      const { ports } = await run(at(sub));
      expect(ports[0].role).toBe(role);
    });

    it("rola z komendy, gdy katalog nic nie mówi", async () => {
      withProject();
      const back = await run(
        at("", { process: "python", commandLine: "python -m uvicorn main:app" })
      );
      expect(back.ports[0].role).toBe("backend");
      const front = await run(
        at("", { process: "node", commandLine: "node ./node_modules/.bin/vite" })
      );
      expect(front.ports[0].role).toBe("frontend");
      const next = await run(at("", { process: "next-server (v1", commandLine: null }));
      expect(next.ports[0].role).toBeNull();
    });

    it("bez projektu nie ma roli", async () => {
      const { ports } = await run(
        entry({ cwd: "/tmp/x", process: "python", commandLine: "uvicorn x:y" })
      );
      expect(ports[0].role).toBeNull();
    });

    it.each([
      [[{ pid: 1, name: "systemd" }], true],
      [
        [
          { pid: 487, name: "systemd" },
          { pid: 1, name: "systemd" },
        ],
        true,
      ],
      [
        [
          { pid: 50, name: "bash" },
          { pid: 1, name: "systemd" },
        ],
        false,
      ],
      [[], false],
    ])("sierota dla przodków %j → %s", async (ancestors, orphan) => {
      withProject();
      const { ports } = await run(at("frontend", { ancestors }));
      expect(ports[0].orphan).toBe(orphan);
    });

    it("proces bez projektu nie jest oznaczany jako sierota", async () => {
      const { ports } = await run(entry({ ancestors: [{ pid: 1, name: "systemd" }] }));
      expect(ports[0].orphan).toBe(false);
    });

    it("grupa: wspólny rodzic (np. concurrently) dla dwóch procesów projektu", async () => {
      withProject();
      const common = [
        { pid: 20, name: "node" },
        { pid: 1, name: "systemd" },
      ];
      const { groups } = await run(
        at("frontend", { pid: 1, port: 5173, ancestors: [{ pid: 11, name: "sh" }, ...common] }),
        at("backend", { pid: 2, port: 8001, ancestors: [{ pid: 12, name: "sh" }, ...common] })
      );
      expect(groups).toEqual([
        { projectId: "tester-ai", launcher: { pid: 20, name: "node" }, missingRole: null },
      ]);
    });

    it("grupa: wspólny jest tylko systemd albo jeden proces → brak launchera", async () => {
      withProject();
      const sys = [{ pid: 1, name: "systemd" }];
      const two = await run(
        at("frontend", { pid: 1, port: 5173, ancestors: [{ pid: 11, name: "sh" }, ...sys] }),
        at("backend", { pid: 2, port: 8001, ancestors: [{ pid: 12, name: "sh" }, ...sys] })
      );
      expect(two.groups[0].launcher).toBeNull();
      const one = await run(at("frontend", { ancestors: [{ pid: 20, name: "node" }, ...sys] }));
      expect(one.groups[0].launcher).toBeNull();
    });

    it("grupy tylko dla projektów, które mają wiersze; osobne projekty nie mieszają się", async () => {
      mockProjects.mockReturnValue({
        projects: [project("tester-ai", ROOT), project("mono", "/home/u/projects/Monolith")],
        warnings: [],
      });
      const { groups } = await run(
        at("frontend", { port: 5173 }),
        entry({ cwd: "/home/u/projects/Monolith", port: 3100, pid: 9 }),
        entry({ cwd: "/tmp/inne", port: 9999, pid: 10 })
      );
      expect(groups.map((g) => g.projectId).sort()).toEqual(["mono", "tester-ai"]);
    });

    it("brakująca rola: projekt ma frontend i backend, a działa tylko frontend", async () => {
      withProject();
      mockSubdirs.mockResolvedValue(["frontend", "backend", "docs"]);
      const { groups } = await run(at("frontend", { port: 5173 }));
      expect(groups[0].missingRole).toBe("backend");
      expect(mockSubdirs).toHaveBeenCalledWith(ROOT);
    });

    it("brakująca rola: odwrotnie (działa tylko backend)", async () => {
      withProject();
      mockSubdirs.mockResolvedValue(["frontend", "backend"]);
      const { groups } = await run(at("backend", { port: 8001 }));
      expect(groups[0].missingRole).toBe("frontend");
    });

    it("brak brakującej roli: działają obie, projekt nie ma obu katalogów albo odczyt się nie udał", async () => {
      withProject();
      mockSubdirs.mockResolvedValue(["frontend", "backend"]);
      const both = await run(at("frontend", { port: 5173 }), at("backend", { pid: 2, port: 8001 }));
      expect(both.groups[0].missingRole).toBeNull();
      mockSubdirs.mockResolvedValue(["frontend"]);
      const noBackendDir = await run(at("frontend", { port: 5173 }));
      expect(noBackendDir.groups[0].missingRole).toBeNull();
      mockSubdirs.mockResolvedValue([]);
      const unreadable = await run(at("frontend", { port: 5173 }));
      expect(unreadable.groups[0].missingRole).toBeNull();
    });

    it("projekt ze ścieżką -prod szuka podkatalogów w głównym katalogu projektu", async () => {
      withProject();
      mockSubdirs.mockResolvedValue(["frontend", "backend"]);
      await run(entry({ cwd: `${ROOT}-prod/frontend`, port: 5173 }));
      expect(mockSubdirs).toHaveBeenCalledWith(ROOT);
    });
  });

  it("buduje killCommand, redaguje commandLine i nie bierze nic z nazwy procesu", async () => {
    mockWsl.mockResolvedValue(
      ok(entry({ process: "x; rm -rf ~", pid: 42, commandLine: "srv --token=abc" }))
    );
    const [p] = (await listPorts({ now: NOW })).ports;
    expect(p.killCommand).toBe("kill 42");
    expect(p.killCommand).not.toContain("rm");
    expect(p.commandLine).toBe("srv --token=***");
  });

  it("wiersz bez PID ma killCommand null", async () => {
    mockWsl.mockResolvedValue(ok(entry({ pid: null })));
    expect((await listPorts({ now: NOW })).ports[0].killCommand).toBeNull();
  });
});
