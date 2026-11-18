// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExecFile = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFile: mockExecFile }));

import { fetchReviewedUpdates } from "@/lib/github/reviewed-updates";

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

const REVIEWED_AT = "2026-11-18T12:00:00Z";

const node = (over: Record<string, unknown> = {}) => ({
  number: 7,
  title: "PR siedem",
  url: "https://github.com/o/r/pull/7",
  author: { login: "autor" },
  repository: { nameWithOwner: "o/r" },
  reviews: { nodes: [{ submittedAt: REVIEWED_AT, author: { login: "me" } }] },
  commits: { nodes: [{ commit: { committedDate: "2026-11-18T10:00:00Z" } }] },
  comments: { nodes: [] },
  reviewThreads: { nodes: [] },
  ...over,
});

const payload = (nodes: unknown[], login: string | null = "me") =>
  JSON.stringify({ data: { viewer: { login }, search: { nodes } } });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fetchReviewedUpdates", () => {
  it("commit po moim review: wiersz z datą tej aktywności", async () => {
    ghReturns(
      payload([
        node({ commits: { nodes: [{ commit: { committedDate: "2026-11-18T15:00:00Z" } }] } }),
      ])
    );
    expect(await fetchReviewedUpdates()).toEqual({
      ok: true,
      items: [
        {
          repo: "o/r",
          number: 7,
          title: "PR siedem",
          author: "autor",
          url: "https://github.com/o/r/pull/7",
          updatedAt: "2026-11-18T15:00:00.000Z",
        },
      ],
    });
  });

  it("cudzy komentarz po review liczy się, mój komentarz po review nie", async () => {
    ghReturns(
      payload([
        node({
          comments: { nodes: [{ createdAt: "2026-11-18T13:00:00Z", author: { login: "autor" } }] },
        }),
        node({
          number: 8,
          url: "https://github.com/o/r/pull/8",
          comments: { nodes: [{ createdAt: "2026-11-18T13:00:00Z", author: { login: "me" } }] },
        }),
      ])
    );
    const res = await fetchReviewedUpdates();
    if (res.ok === false) throw new Error("oczekiwano ok");
    expect(res.items.map((i) => [i.number, i.updatedAt])).toEqual([
      [7, "2026-11-18T13:00:00.000Z"],
    ]);
  });

  it("odpowiedź w wątku kodu po review liczy się", async () => {
    ghReturns(
      payload([
        node({
          reviewThreads: {
            nodes: [
              {
                comments: {
                  nodes: [
                    { createdAt: "2026-11-18T09:00:00Z", author: { login: "me" } },
                    { createdAt: "2026-11-18T14:00:00Z", author: { login: "autor" } },
                  ],
                },
              },
            ],
          },
        }),
      ])
    );
    const res = await fetchReviewedUpdates();
    if (res.ok === false) throw new Error("oczekiwano ok");
    expect(res.items.map((i) => i.updatedAt)).toEqual(["2026-11-18T14:00:00.000Z"]);
  });

  it("bierze najnowszą z kilku aktywności i ostatnie z moich review", async () => {
    ghReturns(
      payload([
        node({
          reviews: {
            nodes: [
              { submittedAt: "2026-11-17T08:00:00Z", author: { login: "me" } },
              { submittedAt: REVIEWED_AT, author: { login: "me" } },
              { submittedAt: "2026-11-18T20:00:00Z", author: { login: "inny" } },
            ],
          },
          commits: { nodes: [{ commit: { committedDate: "2026-11-18T13:00:00Z" } }] },
          comments: { nodes: [{ createdAt: "2026-11-18T16:00:00Z", author: { login: "inny" } }] },
        }),
      ])
    );
    const res = await fetchReviewedUpdates();
    if (res.ok === false) throw new Error("oczekiwano ok");
    expect(res.items.map((i) => i.updatedAt)).toEqual(["2026-11-18T16:00:00.000Z"]);
  });

  it.each([
    [
      "aktywność przed review",
      { commits: { nodes: [{ commit: { committedDate: "2026-11-18T11:59:59Z" } }] } },
    ],
    ["mój własny PR", { author: { login: "me" } }],
    [
      "brak mojego review",
      { reviews: { nodes: [{ submittedAt: REVIEWED_AT, author: { login: "inny" } }] } },
    ],
    [
      "review PENDING (bez submittedAt)",
      { reviews: { nodes: [{ submittedAt: null, author: { login: "me" } }] } },
    ],
    ["url spoza github.com", { url: "https://evil.example/o/r/pull/7" }],
    ["zły numer", { number: 0 }],
    ["brak repozytorium", { repository: null }],
  ])("pomija PR: %s", async (_name, over) => {
    ghReturns(
      payload([
        node({
          commits: { nodes: [{ commit: { committedDate: "2026-11-18T15:00:00Z" } }] },
          ...over,
        }),
      ])
    );
    const res = await fetchReviewedUpdates();
    if (res.ok === false) throw new Error("oczekiwano ok");
    expect(res.items).toEqual([]);
  });

  it("autor null (usunięte konto) to author null", async () => {
    ghReturns(
      payload([
        node({
          author: null,
          commits: { nodes: [{ commit: { committedDate: "2026-11-18T15:00:00Z" } }] },
        }),
      ])
    );
    const res = await fetchReviewedUpdates();
    if (res.ok === false) throw new Error("oczekiwano ok");
    expect(res.items.map((i) => i.author)).toEqual([null]);
  });

  it("woła gh api graphql ze stałym zapytaniem", async () => {
    ghReturns(payload([]));
    await fetchReviewedUpdates();
    const args = mockExecFile.mock.calls[0][1] as string[];
    expect(mockExecFile.mock.calls[0][0]).toBe("gh");
    expect(args.slice(0, 3)).toEqual(["api", "graphql", "-f"]);
    expect(args[3]).toBe("q=is:pr is:open reviewed-by:@me -author:@me sort:updated-desc");
    expect(args[4]).toBe("-f");
    expect(args[5]).toContain("query=query($q:String!)");
  });

  it("błędy: GraphQL errors, zły JSON, brak viewer, gh-missing, gh-error", async () => {
    ghReturns(JSON.stringify({ errors: [{ message: "SAML" }], data: null }));
    expect(await fetchReviewedUpdates()).toEqual({ ok: false, reason: "gh-error" });
    ghReturns("nie json");
    expect(await fetchReviewedUpdates()).toEqual({ ok: false, reason: "gh-error" });
    ghReturns(payload([], null));
    expect(await fetchReviewedUpdates()).toEqual({ ok: false, reason: "gh-error" });
    ghFails("ENOENT");
    expect(await fetchReviewedUpdates()).toEqual({ ok: false, reason: "gh-missing" });
    ghFails(1);
    expect(await fetchReviewedUpdates()).toEqual({ ok: false, reason: "gh-error" });
  });
});
