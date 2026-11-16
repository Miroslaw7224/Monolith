import { execFile } from "node:child_process";

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
const TIMEOUT_MS = 8000;
const MAX_BUFFER = 256 * 1024;

type Run = { ok: true; stdout: string } | { ok: false; reason: "gh-missing" | "gh-error" };

/** Uruchamia `gh` bez powłoki i bez blokowania pętli zdarzeń; nigdy nie rzuca. */
function runGh(): Promise<Run> {
  return new Promise((resolve) => {
    try {
      execFile(
        "gh",
        GH_ARGS,
        {
          encoding: "utf8",
          timeout: TIMEOUT_MS,
          maxBuffer: MAX_BUFFER,
          env: {
            ...process.env,
            GH_PROMPT_DISABLED: "1",
            GH_PAGER: "cat",
            NO_COLOR: "1",
            GH_NO_UPDATE_NOTIFIER: "1",
          },
        },
        (err, stdout) => {
          if (err) {
            const code = (err as NodeJS.ErrnoException).code;
            resolve({ ok: false, reason: code === "ENOENT" ? "gh-missing" : "gh-error" });
            return;
          }
          resolve({ ok: true, stdout: String(stdout) });
        }
      );
    } catch {
      resolve({ ok: false, reason: "gh-error" });
    }
  });
}

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
  const run = await runGh();
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
