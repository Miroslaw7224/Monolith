import { runGh } from "./gh";
import { asObject, isGithubUrl, isIsoDate } from "./parse";

/** Własny, otwarty PR (spłaszczony wynik `gh`). */
export type GithubOpenPr = {
  /** `właściciel/repo`. */
  repo: string;
  number: number;
  title: string;
  url: string;
  /** Data ISO ostatniej zmiany PR-a. */
  updatedAt: string;
  /** PR w trybie draft. */
  draft: boolean;
};

export type OpenPrsResult =
  | { ok: true; items: GithubOpenPr[] }
  | { ok: false; reason: "gh-missing" | "gh-error" };

/** Biała lista: jedyne wywołanie `gh`, jakie ta warstwa potrafi wykonać (tylko odczyt, bez argumentów z zewnątrz). */
const GH_ARGS = [
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
];

function parseItem(raw: unknown): GithubOpenPr | null {
  const r = asObject(raw);
  if (!r) return null;
  const repo = asObject(r.repository)?.nameWithOwner;
  const { number, title, url, updatedAt, isDraft } = r;
  if (typeof repo !== "string" || repo === "") return null;
  if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) return null;
  if (typeof title !== "string" || title === "") return null;
  if (typeof url !== "string" || !isGithubUrl(url)) return null;
  if (!isIsoDate(updatedAt)) return null;
  if (typeof isDraft !== "boolean") return null;
  return { repo, number, title, url, updatedAt, draft: isDraft };
}

/** Własne otwarte PR-y (konto zalogowane w `gh`; repo publiczne, prywatne i organizacji), najnowsze pierwsze. Błąd `gh` to `ok: false`, nie wyjątek. */
export async function fetchMyOpenPrs(): Promise<OpenPrsResult> {
  const run = await runGh(GH_ARGS);
  if (run.ok === false) return run;
  let parsed: unknown;
  try {
    parsed = JSON.parse(run.stdout);
  } catch {
    return { ok: false, reason: "gh-error" };
  }
  if (!Array.isArray(parsed)) return { ok: false, reason: "gh-error" };
  const items: GithubOpenPr[] = [];
  for (const raw of parsed) {
    const item = parseItem(raw);
    if (item) items.push(item);
  }
  return { ok: true, items };
}
