import React from "react";
import { Loader2 } from "lucide-react";
import type { ArsenalEntryDto, DeployTargetDto } from "@/contexts/bc_arsenal/schemas";
import { useT } from "@/src/i18n/useT";
import "@/src/features/resources/resources.css";
import "./arsenal.css";
import { ArsenalDetail, KIND_LABEL, projectName } from "./ArsenalDetail";
import { ArsenalFilterBar } from "./ArsenalFilterBar";
import { catalogStats, entryProjects, promptModels } from "./arsenalFilters";
import { CopyButton } from "./CopyButton";
import { useArsenal, type ApiFetch } from "./useArsenal";

function Tile({
  label,
  value,
  meta,
  accent = false,
}: {
  label: string;
  value: number;
  meta: string;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "asv-tile asv-tile--accent" : "asv-tile"}>
      <span className="asv-tile__label">{label}</span>
      <span className="asv-tile__value">{value}</span>
      <span className="asv-tile__meta">{meta}</span>
    </div>
  );
}

function EntryCard({
  entry,
  targets,
  selected,
  onSelect,
}: {
  entry: ArsenalEntryDto;
  targets: DeployTargetDto[];
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  const projects = entryProjects(entry);
  const meta =
    entry.kind === "skill"
      ? entry.deployed.length === 0
        ? t("arsenal:arsenalCardUndeployed")
        : t("arsenal:arsenalCardDeployedIn", { count: entry.deployed.length })
      : (entry.model ?? t("arsenal:arsenalPromptFallback"));
  return (
    <article className="asv-card" data-kind={entry.kind} data-selected={selected}>
      <button type="button" className="asv-card__main" aria-pressed={selected} onClick={onSelect}>
        <span className="asv-card__head">
          <span className="asv-card__name">{entry.name}</span>
          <span className="asv-badge" data-kind={entry.kind}>
            {KIND_LABEL[entry.kind]}
          </span>
        </span>
        <span className="asv-card__desc">{entry.summary}</span>
      </button>
      <div className="asv-card__foot">
        {projects.length > 0 && (
          <span className="asv-card__projects">
            {projects.map((id) => (
              <span key={id} className="asv-chip-static">
                {projectName(targets, id)}
              </span>
            ))}
          </span>
        )}
        <span className="asv-card__end">
          <span className="asv-card__meta">{meta}</span>
          {entry.kind === "skill" ? (
            <CopyButton text={`/${entry.slug}`} ariaLabel={t("arsenal:arsenalCopyInvocation")} />
          ) : (
            <CopyButton text={entry.body} ariaLabel={t("arsenal:arsenalCopyPrompt")} />
          )}
        </span>
      </div>
    </article>
  );
}

export function ArsenalSkillsView({ apiFetch }: { apiFetch: ApiFetch }) {
  const t = useT();
  const a = useArsenal(apiFetch);
  const stats = catalogStats(a.allEntries);
  const eyebrow = `Alt+7 · ${t("shell:cards.arsenal")}`;
  const entriesLine = t("arsenal:arsenalEntriesCount", { count: a.total });
  const skippedLine = a.skipped > 0 ? t("arsenal:arsenalSkippedSuffix", { count: a.skipped }) : "";

  return (
    <div className="ars asv" data-card="arsenal">
      <header className="ars-head">
        <div>
          <p className="ars-eyebrow">{eyebrow}</p>
          <h1 className="ars-title">{t("arsenal:arsenalTitle")}</h1>
          <p className="ars-sub">
            {entriesLine}
            {skippedLine}
          </p>
        </div>
      </header>

      {a.loading ? (
        <Loader2 className="animate-spin" aria-label={t("arsenal:arsenalLoading")} />
      ) : a.error !== null ? (
        <p role="alert" className="asv-error">
          {a.error}
        </p>
      ) : (
        <>
          <section className="asv-tiles" aria-label={t("arsenal:arsenalStatsAria")}>
            <Tile
              label={t("arsenal:arsenalTileSkills")}
              value={stats.skills}
              meta={t("arsenal:arsenalTileSkillsMeta")}
              accent
            />
            <Tile
              label={t("arsenal:arsenalTilePrompts")}
              value={stats.prompts}
              meta={t("arsenal:arsenalTilePromptsMeta")}
            />
            <Tile
              label={t("arsenal:arsenalTileUndeployed")}
              value={stats.undeployed}
              meta={t("arsenal:arsenalTileUndeployedMeta")}
            />
          </section>

          <div className="asv-layout">
            <div className="asv-main">
              <ArsenalFilterBar
                filters={a.filters}
                onChange={a.setFilters}
                targets={a.targets}
                models={promptModels(a.allEntries)}
              />
              <ul className="asv-grid" role="list">
                {a.entries.map((entry) => (
                  <li key={entry.id}>
                    <EntryCard
                      entry={entry}
                      targets={a.targets}
                      selected={entry.id === a.selected?.id}
                      onSelect={() => a.setSelectedId(entry.id)}
                    />
                  </li>
                ))}
                {a.entries.length === 0 && (
                  <li className="asv-empty">{t("arsenal:arsenalEmptyFilters")}</li>
                )}
              </ul>
            </div>
            <ArsenalDetail
              key={a.selected?.id ?? "none"}
              entry={a.selected}
              targets={a.targets}
              fetchInstructions={a.fetchInstructions}
              markDeployed={a.markDeployed}
            />
          </div>
        </>
      )}
    </div>
  );
}
