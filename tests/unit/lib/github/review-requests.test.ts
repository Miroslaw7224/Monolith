// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExecFile = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFile: mockExecFile }));

import { fetchReviewRequests } from "@/lib/github/review-requests";

type Done = (err: Error | null, stdout?: string, stderr?: string) => void;

function ghReturns(stdout: string) {
  mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: object, done: Done) => {
    done(null, stdout, "");
  });
}

function ghFails(code: string | number) {
  mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: object, done: Done) => {
    done(Object.assign(new Error("gh failed"), { code }), "", "");
  });
}

const PR = {
  number: 1476,
  title: "fix(matchers): słownik",
  url: "https://github.com/crait-p-s-a/career-guide/pull/1476",
  author: { login: "Adiszef-ai", type: "User" },
  repository: { name: "career-guide", nameWithOwner: "crait-p-s-a/career-guide" },
  updatedAt: "2026-11-16T05:58:28Z",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fetchReviewRequests", () => {
  it("poprawny JSON: spłaszcza pola do `repo` i `author`", async () => {
    ghReturns(JSON.stringify([PR]));
    expect(await fetchReviewRequests()).toEqual({
      ok: true,
      items: [
        {
          repo: "crait-p-s-a/career-guide",
          number: 1476,
          title: "fix(matchers): słownik",
          author: "Adiszef-ai",
          url: "https://github.com/crait-p-s-a/career-guide/pull/1476",
          updatedAt: "2026-11-16T05:58:28Z",
        },
      ],
    });
  });

  it("pusta tablica to ok z pustą listą", async () => {
    ghReturns("[]");
    expect(await fetchReviewRequests()).toEqual({ ok: true, items: [] });
  });

  it("author null albo bez login: pozycja zostaje, author null", async () => {
    ghReturns(
      JSON.stringify([
        { ...PR, author: null },
        { ...PR, number: 2, author: {} },
      ])
    );
    const res = await fetchReviewRequests();
    if (res.ok === false) throw new Error("oczekiwano ok");
    expect(res.items.map((i) => i.author)).toEqual([null, null]);
  });

  it.each([
    ["brak url", { ...PR, url: undefined }],
    ["http zamiast https", { ...PR, url: "http://github.com/o/r/pull/1" }],
    ["obca domena z prefiksem github.com", { ...PR, url: "https://github.com.evil.example/x" }],
    ["inna domena", { ...PR, url: "https://example.com/o/r/pull/1" }],
    ["url niebędący adresem", { ...PR, url: "nie-adres" }],
    ["brak number", { ...PR, number: undefined }],
    ["number niecałkowity", { ...PR, number: 1.5 }],
    ["pusty title", { ...PR, title: "" }],
    ["brak repository", { ...PR, repository: undefined }],
    ["brak nameWithOwner", { ...PR, repository: { name: "x" } }],
    ["updatedAt nie jest datą", { ...PR, updatedAt: "nie-data" }],
    ["brak updatedAt", { ...PR, updatedAt: undefined }],
  ])("pomija pozycję: %s", async (_name, bad) => {
    ghReturns(JSON.stringify([bad, { ...PR, number: 7 }]));
    const res = await fetchReviewRequests();
    if (res.ok === false) throw new Error("oczekiwano ok");
    expect(res.items.map((i) => i.number)).toEqual([7]);
  });

  it("ENOENT to gh-missing", async () => {
    ghFails("ENOENT");
    expect(await fetchReviewRequests()).toEqual({ ok: false, reason: "gh-missing" });
  });

  it.each([
    ["kod wyjścia 1", () => ghFails(1)],
    ["przekroczony maxBuffer", () => ghFails("ERR_CHILD_PROCESS_STDIO_MAXBUFFER")],
    ["niepoprawny JSON", () => ghReturns("{nie json")],
    ["JSON niebędący tablicą", () => ghReturns('{"a":1}')],
  ])("gh-error: %s", async (_name, setup) => {
    setup();
    expect(await fetchReviewRequests()).toEqual({ ok: false, reason: "gh-error" });
  });

  it("execFile rzucający synchronicznie to gh-error (bez wyjątku)", async () => {
    mockExecFile.mockImplementation(() => {
      throw new Error("spawn");
    });
    expect(await fetchReviewRequests()).toEqual({ ok: false, reason: "gh-error" });
  });

  it("woła gh dokładnie z białą listą argumentów i bezpiecznym środowiskiem", async () => {
    ghReturns("[]");
    await fetchReviewRequests();
    expect(mockExecFile).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = mockExecFile.mock.calls[0] as [
      string,
      string[],
      { timeout: number; maxBuffer: number; env: Record<string, string | undefined> },
    ];
    expect(cmd).toBe("gh");
    expect(args).toEqual([
      "search",
      "prs",
      "--review-requested=@me",
      "--state=open",
      "--limit",
      "30",
      "--json",
      "number,title,url,author,repository,updatedAt",
    ]);
    expect(opts.timeout).toBe(8000);
    expect(opts.maxBuffer).toBe(256 * 1024);
    expect(opts.env.GH_PROMPT_DISABLED).toBe("1");
    expect(opts.env.GH_PAGER).toBe("cat");
    expect(opts.env.NO_COLOR).toBe("1");
    expect(opts.env.GH_NO_UPDATE_NOTIFIER).toBe("1");
    expect(opts.env.PATH).toBe(process.env.PATH);
  });
});
