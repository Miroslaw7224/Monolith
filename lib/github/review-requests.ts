import { runGh } from "./gh";

/** PR (otwarty albo już zmergowany), w którym użytkownik nadal jest wskazanym recenzentem (spłaszczony wynik `gh`). */
export type GithubReviewRequest = {
  /** `właściciel/repo`. */
  repo: string;
  number: number;
  title: string;
  /** Login autora; `null`, gdy GitHub go nie podał. */
  author: string | null;
  url: string;
  /** Data ISO ostatniej zmiany PR-a. */
  updatedAt: string;
  /** Zmergowany PR nadal czeka na review, dopóki użytkownik go nie zostawi. */
  state: "open" | "merged";
};

export type ReviewRequestsResult =
  | { ok: true; items: GithubReviewRequest[] }
  | { ok: false; reason: "gh-missing" | "gh-error" };

/** Biała lista: jedyne wywołanie `gh`, jakie ta warstwa potrafi wykonać (tylko odczyt, bez argumentów z zewnątrz). */
const GH_ARGS = [
  "search",
  "prs",
  "--review-requested=@me",
  "--sort",
  "updated",
  "--order",
  "desc",
  "--limit",
  "100",
  "--json",
  "number,title,url,author,repository,updatedAt,state",
];
/** `gh` podaje daty ISO-8601 (`2026-11-16T05:58:28Z`); luźne ciągi typu „1” odrzucamy. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/** `url` trafia do `href`, więc przepuszczamy tylko `https://github.com/...` (bez portu i danych logowania). */
function isGithubUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      u.hostname === "github.com" &&
      u.port === "" &&
      u.username === "" &&
      u.password === ""
    );
  } catch {
    return false;
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function parseItem(raw: unknown): GithubReviewRequest | null {
  const r = asObject(raw);
  if (!r) return null;
  const repo = asObject(r.repository)?.nameWithOwner;
  const login = asObject(r.author)?.login;
  const { number, title, url, updatedAt, state } = r;
  if (typeof repo !== "string" || repo === "") return null;
  if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) return null;
  if (typeof title !== "string" || title === "") return null;
  if (typeof url !== "string" || !isGithubUrl(url)) return null;
  if (
    typeof updatedAt !== "string" ||
    !ISO_DATE.test(updatedAt) ||
    !Number.isFinite(Date.parse(updatedAt))
  )
    return null;
  // PR zamknięty bez merge'a: review nic już nie da, więc go pomijamy.
  if (state !== "open" && state !== "merged") return null;
  return {
    repo,
    number,
    title,
    author: typeof login === "string" && login !== "" ? login : null,
    url,
    updatedAt,
    state,
  };
}

/** Otwarte i zmergowane PR-y z wiszącą prośbą o review do użytkownika (konto zalogowane w `gh`), najnowsze pierwsze. Błąd `gh` to `ok: false`, nie wyjątek. */
export async function fetchReviewRequests(): Promise<ReviewRequestsResult> {
  const run = await runGh(GH_ARGS);
  if (run.ok === false) return run;
  let parsed: unknown;
  try {
    parsed = JSON.parse(run.stdout);
  } catch {
    return { ok: false, reason: "gh-error" };
  }
  if (!Array.isArray(parsed)) return { ok: false, reason: "gh-error" };
  const items: GithubReviewRequest[] = [];
  for (const raw of parsed) {
    const item = parseItem(raw);
    if (item) items.push(item);
  }
  return { ok: true, items };
}
