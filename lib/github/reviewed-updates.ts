import { runGh } from "./gh";
import { asObject, isGithubUrl, isIsoDate } from "./parse";

/** Cudzy PR, który zrecenzowałem, a po moim ostatnim review ktoś inny dołożył commit albo komentarz. */
export type GithubUpdatedPr = {
  /** `właściciel/repo`. */
  repo: string;
  number: number;
  title: string;
  /** Login autora; `null`, gdy GitHub go nie podał. */
  author: string | null;
  url: string;
  /** Data ISO ostatniej aktywności po moim review. */
  updatedAt: string;
};

export type ReviewedUpdatesResult =
  | { ok: true; items: GithubUpdatedPr[] }
  | { ok: false; reason: "gh-missing" | "gh-error" };

/** Stałe zapytanie (tylko odczyt): moje review, ostatni commit, ostatnie komentarze i komentarze w wątkach kodu. */
const QUERY =
  "query($q:String!){ viewer{login} search(query:$q, type:ISSUE, first:50){ nodes{ ... on PullRequest{ number title url author{login} repository{nameWithOwner} reviews(last:100){ nodes{ submittedAt author{login} } } commits(last:1){ nodes{ commit{ committedDate } } } comments(last:20){ nodes{ createdAt author{login} } } reviewThreads(last:30){ nodes{ comments(last:3){ nodes{ createdAt author{login} } } } } } } } }";
const SEARCH = "is:pr is:open reviewed-by:@me -author:@me sort:updated-desc";
const MAX_BUFFER = 1024 * 1024;

/**
 * Daty (ms) pól `field` z elementów listy; `own` = tylko moje wpisy, inaczej tylko cudze.
 * Wpisy bez poprawnej daty (np. review PENDING) są pomijane.
 */
function times(list: unknown, field: string, viewer: string, own: boolean): number[] {
  if (!Array.isArray(list)) return [];
  const out: number[] = [];
  for (const raw of list) {
    const o = asObject(raw);
    if (!o) continue;
    const mine = asObject(o.author)?.login === viewer;
    if (mine !== own) continue;
    const value = o[field];
    if (isIsoDate(value)) out.push(Date.parse(value));
  }
  return out;
}

function parseNode(raw: unknown, viewer: string): GithubUpdatedPr | null {
  const n = asObject(raw);
  if (!n) return null;
  const repo = asObject(n.repository)?.nameWithOwner;
  const { number, title, url } = n;
  const login = asObject(n.author)?.login;
  if (typeof repo !== "string" || repo === "") return null;
  if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) return null;
  if (typeof title !== "string" || title === "") return null;
  if (typeof url !== "string" || !isGithubUrl(url)) return null;
  if (login === viewer) return null;

  const mine = times(asObject(n.reviews)?.nodes, "submittedAt", viewer, true);
  if (mine.length === 0) return null;
  const lastReview = Math.max(...mine);

  const activity: number[] = [];
  const commits = asObject(n.commits)?.nodes;
  if (Array.isArray(commits)) {
    for (const c of commits) {
      const date = asObject(asObject(c)?.commit)?.committedDate;
      if (isIsoDate(date)) activity.push(Date.parse(date));
    }
  }
  activity.push(...times(asObject(n.comments)?.nodes, "createdAt", viewer, false));
  const threads = asObject(n.reviewThreads)?.nodes;
  if (Array.isArray(threads)) {
    for (const th of threads) {
      activity.push(...times(asObject(asObject(th)?.comments)?.nodes, "createdAt", viewer, false));
    }
  }
  if (activity.length === 0) return null;
  const last = Math.max(...activity);
  if (last <= lastReview) return null;
  return {
    repo,
    number,
    title,
    author: typeof login === "string" && login !== "" ? login : null,
    url,
    updatedAt: new Date(last).toISOString(),
  };
}

/** Otwarte, cudze PR-y zrecenzowane przeze mnie, z aktywnością innych po moim ostatnim review. Błąd `gh` to `ok: false`, nie wyjątek. */
export async function fetchReviewedUpdates(): Promise<ReviewedUpdatesResult> {
  const run = await runGh(
    ["api", "graphql", "-f", `q=${SEARCH}`, "-f", `query=${QUERY}`],
    MAX_BUFFER
  );
  if (run.ok === false) return run;
  let body: Record<string, unknown> | null;
  try {
    body = asObject(JSON.parse(run.stdout));
  } catch {
    return { ok: false, reason: "gh-error" };
  }
  // częściowy błąd GraphQL (np. SAML) nie może wyglądać jak komplet danych
  if (Array.isArray(body?.errors) && body.errors.length > 0)
    return { ok: false, reason: "gh-error" };
  const data = asObject(body?.data);
  const viewer = asObject(data?.viewer)?.login;
  const nodes = asObject(data?.search)?.nodes;
  if (typeof viewer !== "string" || viewer === "" || !Array.isArray(nodes)) {
    return { ok: false, reason: "gh-error" };
  }
  const items: GithubUpdatedPr[] = [];
  for (const raw of nodes) {
    const item = parseNode(raw, viewer);
    if (item) items.push(item);
  }
  return { ok: true, items };
}
