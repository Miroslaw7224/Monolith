import { PACK_BUDGET_TOKENS } from "@/contexts/bc_projects/schemas";
import type { ProjectDetailDto, ProjectSummaryDto } from "@/contexts/bc_projects/schemas";
import i18n from "@/src/i18n";
import { kindCountLabel, packBudgetMeta, packTileValue } from "./projectsFormat";
import type { PackState } from "./useContextPack";

export type ProjectTile = {
  id: "active" | "bugs" | "stale" | "pack";
  label: string;
  value: string;
  meta: string;
  accent?: boolean;
  tone?: "danger";
};

const KINDS: ProjectSummaryDto["kind"][] = ["wlasny", "biblioteka", "etat"];

/** Projekt uśpiony przyciskiem „Uśpij” (status `paused`): nie wymaga decyzji, nie świeci na czerwono. */
export const isPaused = (p: Pick<ProjectSummaryDto, "status">): boolean =>
  p.status.toLowerCase() === "paused";

/** Projekt bez zmian ponad 14 dni, o którym trzeba zdecydować (uśpionych i zakończonych nie liczymy). */
export function needsDecision(p: Pick<ProjectSummaryDto, "status" | "freshness">): boolean {
  const status = p.status.toLowerCase();
  return p.freshness === "stale" && status !== "paused" && status !== "done";
}

function packTile(detail: ProjectDetailDto | null, pack: PackState): ProjectTile {
  const base = { id: "pack" as const, label: i18n.t("projects:tiles.packLabel") };
  const noSelection = i18n.t("projects:tiles.noSelection");
  if (detail === null) return { ...base, value: "—", meta: noSelection };
  if (pack.status === "loading")
    return { ...base, value: "—", meta: i18n.t("projects:tiles.packLoading") };
  if (pack.status === "error")
    return { ...base, value: "—", meta: i18n.t("projects:tiles.packError") };
  const percent = Math.round((pack.pack.approxTokens / PACK_BUDGET_TOKENS) * 100);
  return {
    ...base,
    value: packTileValue(pack.pack.approxTokens),
    meta: packBudgetMeta(percent, PACK_BUDGET_TOKENS, pack.pack.truncated),
  };
}

/** Cztery kafle statystyk rejestru (makieta 04): liczby z listy projektów, wybranej teczki i jej paczki kontekstu. */
export function buildProjectTiles(
  projects: ProjectSummaryDto[],
  detail: ProjectDetailDto | null,
  pack: PackState = { status: "loading" }
): ProjectTile[] {
  const active = projects.filter((p) => p.status.toLowerCase() === "active");
  const kindParts = KINDS.map(
    (kind) => [active.filter((p) => p.kind === kind).length, kindCountLabel(kind)] as const
  );
  const parts = kindParts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`);

  const stale = projects.filter(needsDecision);
  const staleNames = stale.slice(0, 2).map((p) => p.name);
  const staleRest = stale.length - staleNames.length;
  const staleMeta =
    stale.length === 0
      ? i18n.t("projects:tiles.metaFresh")
      : staleRest > 0
        ? i18n.t("projects:tiles.metaStaleMore", {
            names: staleNames.join(", "),
            rest: staleRest,
          })
        : staleNames.join(", ");

  const activeBugs = detail ? detail.bugs.filter((b) => b.section !== "Zamknięte").length : null;
  const noSelection = i18n.t("projects:tiles.noSelection");

  return [
    {
      id: "active",
      label: i18n.t("projects:tiles.activeLabel"),
      value: String(active.length),
      meta: parts.length > 0 ? parts.join(" · ") : i18n.t("projects:tiles.metaNoActive"),
      accent: true,
    },
    {
      id: "bugs",
      label: i18n.t("projects:tiles.bugsLabel"),
      value: activeBugs === null ? "—" : String(activeBugs),
      meta: detail ? i18n.t("projects:tiles.metaInProject", { name: detail.name }) : noSelection,
    },
    {
      id: "stale",
      label: i18n.t("projects:tiles.staleLabel"),
      value: String(stale.length),
      meta: staleMeta,
      ...(stale.length > 0 ? { tone: "danger" as const } : {}),
    },
    packTile(detail, pack),
  ];
}
