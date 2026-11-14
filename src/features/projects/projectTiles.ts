import { PACK_BUDGET_TOKENS } from "@/contexts/bc_projects/schemas";
import type { ProjectDetailDto, ProjectSummaryDto } from "@/contexts/bc_projects/schemas";
import { formatTokens } from "./packSections";
import type { PackState } from "./useContextPack";

export type ProjectTile = {
  id: "active" | "bugs" | "stale" | "pack";
  label: string;
  value: string;
  meta: string;
  accent?: boolean;
  tone?: "danger";
};

const TYPE_LABELS: [NonNullable<ProjectSummaryDto["type"]>, string][] = [
  ["wlasny", "własne"],
  ["biblioteka", "biblioteka"],
  ["etat", "etat"],
];

const NO_SELECTION = "wybierz projekt";

/** Projekt uśpiony przyciskiem „Uśpij” (status `paused`): nie wymaga decyzji, nie świeci na czerwono. */
export const isPaused = (p: Pick<ProjectSummaryDto, "status">): boolean =>
  p.status.toLowerCase() === "paused";

/** Projekt bez zmian ponad 14 dni, o którym trzeba zdecydować (uśpionych i zakończonych nie liczymy). */
export function needsDecision(p: Pick<ProjectSummaryDto, "status" | "freshness">): boolean {
  const status = p.status.toLowerCase();
  return p.freshness === "stale" && status !== "paused" && status !== "done";
}

function packTile(detail: ProjectDetailDto | null, pack: PackState): ProjectTile {
  const base = { id: "pack" as const, label: "Paczka kontekstu" };
  if (detail === null) return { ...base, value: "—", meta: NO_SELECTION };
  if (pack.status === "loading") return { ...base, value: "—", meta: "składam paczkę…" };
  if (pack.status === "error") return { ...base, value: "—", meta: "paczka niedostępna" };
  const percent = Math.round((pack.pack.approxTokens / PACK_BUDGET_TOKENS) * 100);
  return {
    ...base,
    value: `${formatTokens(pack.pack.approxTokens)} tok`,
    meta: `${percent}% budżetu ${formatTokens(PACK_BUDGET_TOKENS)} tokenów${
      pack.pack.truncated ? " · skrócona" : ""
    }`,
  };
}

/** Cztery kafle statystyk rejestru (makieta 04): liczby z listy projektów, wybranej teczki i jej paczki kontekstu. */
export function buildProjectTiles(
  projects: ProjectSummaryDto[],
  detail: ProjectDetailDto | null,
  pack: PackState = { status: "loading" }
): ProjectTile[] {
  const active = projects.filter((p) => p.status.toLowerCase() === "active");
  const typeParts = TYPE_LABELS.map(
    ([type, label]) => [active.filter((p) => p.type === type).length, label] as const
  );
  const untyped = active.filter((p) => !p.type).length;
  const parts = typeParts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`);
  if (untyped > 0) parts.push(`${untyped} bez typu`);

  const stale = projects.filter(needsDecision);
  const staleNames = stale.slice(0, 2).map((p) => p.name);
  const staleRest = stale.length - staleNames.length;
  const staleMeta =
    stale.length === 0
      ? "wszystko świeże"
      : staleRest > 0
        ? `${staleNames.join(", ")} i ${staleRest} więcej`
        : staleNames.join(", ");

  const activeBugs = detail ? detail.bugs.filter((b) => b.section !== "Zamknięte").length : null;

  return [
    {
      id: "active",
      label: "Aktywne projekty",
      value: String(active.length),
      meta: parts.length > 0 ? parts.join(" · ") : "brak aktywnych",
      accent: true,
    },
    {
      id: "bugs",
      label: "Aktywne bugi",
      value: activeBugs === null ? "—" : String(activeBugs),
      meta: detail ? `w projekcie ${detail.name}` : NO_SELECTION,
    },
    {
      id: "stale",
      label: "Wymaga decyzji (>14 dni)",
      value: String(stale.length),
      meta: staleMeta,
      ...(stale.length > 0 ? { tone: "danger" as const } : {}),
    },
    packTile(detail, pack),
  ];
}
