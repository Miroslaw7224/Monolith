// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExecFile = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFile: mockExecFile }));

import { fetchMyReviews } from "@/lib/github/my-reviews";

type Done = (err: Error | null, stdout?: string, stderr?: string) => void;

function ghReturns(stdout: string) {
  mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: object, done: Done) => {
    done(null, stdout, "");
  });
}

const review = (over: Record<string, unknown> = {}) => ({
  state: "APPROVED",
  submittedAt: "2026-11-15T18:34:24Z",
  author: { login: "me" },
  ...over,
});

const pr = (number: number, reviews: unknown[], repo = "o/r") => ({
  number,
  repository: { nameWithOwner: repo },
  reviews: { nodes: reviews },
});

const payload = (nodes: unknown[], login: string | null = "me") =>
  JSON.stringify({ data: { viewer: { login }, search: { nodes } } });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fetchMyReviews", () => {
  it("zwraca tylko review użytkownika, spłaszczone do PR-ów", async () => {
    ghReturns(
      payload([
        pr(1, [
          review(),
          review({ state: "COMMENTED", submittedAt: "2026-11-14T10:00:00Z" }),
          review({ author: { login: "inny" } }),
        ]),
        pr(2, [review({ state: "CHANGES_REQUESTED" })], "x/y"),
      ])
    );
    expect(await fetchMyReviews("2026-11-09")).toEqual({
      ok: true,
      reviews: [
        { repo: "o/r", number: 1, state: "APPROVED", submittedAt: "2026-11-15T18:34:24Z" },
        { repo: "o/r", number: 1, state: "COMMENTED", submittedAt: "2026-11-14T10:00:00Z" },
        { repo: "x/y", number: 2, state: "CHANGES_REQUESTED", submittedAt: "2026-11-15T18:34:24Z" },
      ],
    });
  });

  it.each([
    ["PENDING", review({ state: "PENDING" })],
    ["DISMISSED", review({ state: "DISMISSED" })],
    ["brak submittedAt", review({ submittedAt: null })],
    ["zła data", review({ submittedAt: "nie-data" })],
    ["brak autora", review({ author: null })],
  ])("pomija review: %s", async (_name, bad) => {
    ghReturns(payload([pr(1, [bad, review({ state: "COMMENTED" })])]));
    const res = await fetchMyReviews("2026-11-09");
    if (res.ok === false) throw new Error("oczekiwano ok");
    expect(res.reviews.map((r) => r.state)).toEqual(["COMMENTED"]);
  });

  it.each([
    ["brak repository", { number: 1, reviews: { nodes: [review()] } }],
    ["brak number", { repository: { nameWithOwner: "o/r" }, reviews: { nodes: [review()] } }],
    ["węzeł pusty (nie PR)", {}],
    ["null", null],
  ])("pomija PR: %s", async (_name, bad) => {
    ghReturns(payload([bad, pr(5, [review()])]));
    const res = await fetchMyReviews("2026-11-09");
    if (res.ok === false) throw new Error("oczekiwano ok");
    expect(res.reviews.map((r) => r.number)).toEqual([5]);
  });

  it("brak loginu viewer to gh-error", async () => {
    ghReturns(payload([pr(1, [review()])], null));
    expect(await fetchMyReviews("2026-11-09")).toEqual({ ok: false, reason: "gh-error" });
  });

  it.each(["jutro", "2026-1-9", "2026-11-09; rm -rf", ""])(
    "zły updatedSince %j: gh-error bez wywołania gh",
    async (bad) => {
      expect(await fetchMyReviews(bad)).toEqual({ ok: false, reason: "gh-error" });
      expect(mockExecFile).not.toHaveBeenCalled();
    }
  );

  it("niepoprawny JSON i brak data.search to gh-error", async () => {
    ghReturns("{nie json");
    expect(await fetchMyReviews("2026-11-09")).toEqual({ ok: false, reason: "gh-error" });
    ghReturns('{"data":{}}');
    expect(await fetchMyReviews("2026-11-09")).toEqual({ ok: false, reason: "gh-error" });
  });

  it("ENOENT to gh-missing", async () => {
    mockExecFile.mockImplementation((_c: string, _a: string[], _o: object, done: Done) => {
      done(Object.assign(new Error("x"), { code: "ENOENT" }), "", "");
    });
    expect(await fetchMyReviews("2026-11-09")).toEqual({ ok: false, reason: "gh-missing" });
  });

  it("woła gh api graphql z białą listą argumentów i buforem 1 MB", async () => {
    ghReturns(payload([]));
    await fetchMyReviews("2026-11-09");
    const [cmd, args, opts] = mockExecFile.mock.calls[0] as [
      string,
      string[],
      { maxBuffer: number; timeout: number },
    ];
    expect(cmd).toBe("gh");
    expect(args.slice(0, 4)).toEqual([
      "api",
      "graphql",
      "-f",
      "q=is:pr reviewed-by:@me updated:>=2026-11-09",
    ]);
    expect(args[4]).toBe("-f");
    expect(args[5]).toMatch(/^query=query\(\$q:String!\)/);
    expect(args).toHaveLength(6);
    expect(opts.maxBuffer).toBe(1024 * 1024);
    expect(opts.timeout).toBe(8000);
  });
});
