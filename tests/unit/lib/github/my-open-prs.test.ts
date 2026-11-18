// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExecFile = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFile: mockExecFile }));

import { fetchMyOpenPrs } from "@/lib/github/my-open-prs";

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
  number: 5,
  title: "feat: coś",
  url: "https://github.com/o/r/pull/5",
  repository: { name: "r", nameWithOwner: "o/r" },
  updatedAt: "2026-11-16T05:58:28Z",
  isDraft: false,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fetchMyOpenPrs", () => {
  it("poprawny JSON: spłaszcza pola, isDraft trafia do draft", async () => {
    ghReturns(JSON.stringify([PR, { ...PR, number: 6, isDraft: true }]));
    expect(await fetchMyOpenPrs()).toEqual({
      ok: true,
      items: [
        {
          repo: "o/r",
          number: 5,
          title: "feat: coś",
          url: "https://github.com/o/r/pull/5",
          updatedAt: "2026-11-16T05:58:28Z",
          draft: false,
        },
        {
          repo: "o/r",
          number: 6,
          title: "feat: coś",
          url: "https://github.com/o/r/pull/5",
          updatedAt: "2026-11-16T05:58:28Z",
          draft: true,
        },
      ],
    });
  });

  it("woła gh ze stałą białą listą argumentów", async () => {
    ghReturns("[]");
    await fetchMyOpenPrs();
    expect(mockExecFile).toHaveBeenCalledTimes(1);
    expect(mockExecFile.mock.calls[0][0]).toBe("gh");
    expect(mockExecFile.mock.calls[0][1]).toEqual([
      "search",
      "prs",
      "--author=@me",
      "--state=open",
      "--sort",
      "updated",
      "--order",
      "desc",
      "--limit",
      "100",
      "--json",
      "number,title,url,repository,updatedAt,isDraft",
    ]);
  });

  it.each([
    ["url spoza github.com", { url: "https://evil.example/o/r/pull/5" }],
    ["url z http", { url: "http://github.com/o/r/pull/5" }],
    ["number 0", { number: 0 }],
    ["number ułamkowy", { number: 1.5 }],
    ["zła data", { updatedAt: "1" }],
    ["brak repository", { repository: undefined }],
    ["pusty tytuł", { title: "" }],
    ["isDraft nie boolean", { isDraft: "no" }],
  ])("pomija wiersz: %s", async (_name, patch) => {
    ghReturns(
      JSON.stringify([
        { ...PR, ...patch },
        { ...PR, number: 7 },
      ])
    );
    const res = await fetchMyOpenPrs();
    if (res.ok === false) throw new Error("oczekiwano ok");
    expect(res.items.map((i) => i.number)).toEqual([7]);
  });

  it("niepoprawny JSON i nie-tablica to gh-error", async () => {
    ghReturns("nie json");
    expect(await fetchMyOpenPrs()).toEqual({ ok: false, reason: "gh-error" });
    ghReturns("{}");
    expect(await fetchMyOpenPrs()).toEqual({ ok: false, reason: "gh-error" });
  });

  it("brak gh to gh-missing, inny błąd to gh-error", async () => {
    ghFails("ENOENT");
    expect(await fetchMyOpenPrs()).toEqual({ ok: false, reason: "gh-missing" });
    ghFails(1);
    expect(await fetchMyOpenPrs()).toEqual({ ok: false, reason: "gh-error" });
  });
});
