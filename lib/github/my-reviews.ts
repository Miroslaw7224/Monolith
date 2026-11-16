import { runGh } from "./gh";

/** Własne review użytkownika na PR-ze (otwartym albo zmergowanym). */
export type MyReview = {
  /** `właściciel/repo`. */
  repo: string;
  number: number;
  state: "APPROVED" | "COMMENTED" | "CHANGES_REQUESTED";
  /** Data ISO złożenia review. */
  submittedAt: string;
};

export type MyReviewsResult =
  | { ok: true; reviews: MyReview[] }
  | { ok: false; reason: "gh-missing" | "gh-error" };

/** Stałe zapytanie: PR-y zmienione w oknie, w których użytkownik zostawił review, wraz z jego review. */
const QUERY =
  "query($q:String!){ viewer{login} search(query:$q, type:ISSUE, first:100){ nodes{ ... on PullRequest{ number repository{nameWithOwner} reviews(last:100){ nodes{ state submittedAt author{login} } } } } } }";

/** Odpowiedź bywa duża (do 100 PR-ów z review), więc bufor większy niż domyślny. */
const MAX_BUFFER = 1024 * 1024;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATES = new Set(["APPROVED", "COMMENTED", "CHANGES_REQUESTED"]);

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/**
 * Review użytkownika w PR-ach zmienionych od `updatedSince` (`RRRR-MM-DD`). Błąd `gh` albo
 * nieoczekiwana odpowiedź to `ok: false`, nie wyjątek. Filtrowanie po dacie review robi wołający.
 */
export async function fetchMyReviews(updatedSince: string): Promise<MyReviewsResult> {
  if (!DAY_RE.test(updatedSince)) return { ok: false, reason: "gh-error" };
  const run = await runGh(
    [
      "api",
      "graphql",
      "-f",
      `q=is:pr reviewed-by:@me updated:>=${updatedSince}`,
      "-f",
      `query=${QUERY}`,
    ],
    MAX_BUFFER
  );
  if (run.ok === false) return run;
  let data: Record<string, unknown> | null;
  try {
    data = asObject(asObject(JSON.parse(run.stdout))?.data);
  } catch {
    return { ok: false, reason: "gh-error" };
  }
  const login = asObject(data?.viewer)?.login;
  const nodes = asObject(data?.search)?.nodes;
  if (typeof login !== "string" || login === "" || !Array.isArray(nodes)) {
    return { ok: false, reason: "gh-error" };
  }
  const reviews: MyReview[] = [];
  for (const raw of nodes) {
    const node = asObject(raw);
    const repo = asObject(node?.repository)?.nameWithOwner;
    const number = node?.number;
    const list = asObject(node?.reviews)?.nodes;
    if (typeof repo !== "string" || repo === "") continue;
    if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) continue;
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const r = asObject(item);
      if (!r || asObject(r.author)?.login !== login) continue;
      const { state, submittedAt } = r;
      if (typeof state !== "string" || !STATES.has(state)) continue;
      if (typeof submittedAt !== "string" || !Number.isFinite(Date.parse(submittedAt))) continue;
      reviews.push({ repo, number, state: state as MyReview["state"], submittedAt });
    }
  }
  return { ok: true, reviews };
}
