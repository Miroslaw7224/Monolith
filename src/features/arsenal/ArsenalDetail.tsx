import React from "react";
import type {
  ArsenalEntryDto,
  DeployInstructionsDto,
  DeployModeDto,
  DeployTargetDto,
} from "@/contexts/bc_arsenal/schemas";
import { useT } from "@/src/i18n/useT";
import type { TFn } from "@/src/i18n";
import { CopyButton } from "./CopyButton";
import { DeployPanel } from "./DeployPanel";

type Props = {
  entry: ArsenalEntryDto | null;
  targets: DeployTargetDto[];
  fetchInstructions: (
    slug: string,
    project: string,
    mode: DeployModeDto
  ) => Promise<DeployInstructionsDto>;
  markDeployed: (slug: string, project: string, mode: DeployModeDto) => Promise<void>;
};

export const KIND_LABEL: Record<ArsenalEntryDto["kind"], string> = {
  skill: "Skill",
  prompt: "Prompt",
};

export function modeLabel(mode: DeployModeDto, t: TFn): string {
  return mode === "full" ? t("arsenal:arsenalModeFullShort") : t("arsenal:arsenalModeAdaptedShort");
}

export function projectName(targets: DeployTargetDto[], id: string): string {
  return targets.find((target) => target.id === id)?.name ?? id;
}

export function ArsenalDetail({ entry, targets, fetchInstructions, markDeployed }: Props) {
  const t = useT();
  return (
    <aside className="asv-side" aria-label={t("arsenal:arsenalDetailAria")}>
      {entry === null ? (
        <p className="asv-empty">{t("arsenal:arsenalSelectEntry")}</p>
      ) : (
        <>
          <div className="asv-side__head">
            <span className="asv-badge" data-kind={entry.kind}>
              {KIND_LABEL[entry.kind]}
            </span>
            <h2 className="asv-side__title">{entry.name}</h2>
          </div>
          {entry.summary !== "" && <p className="asv-side__summary">{entry.summary}</p>}

          <dl className="asv-kv">
            <dt>{t("arsenal:arsenalFile")}</dt>
            <dd>{entry.path}</dd>
            {entry.kind === "skill" && entry.origin !== undefined && (
              <>
                <dt>{t("arsenal:arsenalOrigin")}</dt>
                <dd>{entry.origin}</dd>
              </>
            )}
            {entry.kind === "prompt" && entry.model !== undefined && (
              <>
                <dt>{t("arsenal:arsenalModel")}</dt>
                <dd>{entry.model}</dd>
              </>
            )}
            {entry.kind === "prompt" && (
              <>
                <dt>{t("arsenal:arsenalProjects")}</dt>
                <dd>
                  {entry.projects.length > 0
                    ? entry.projects.map((id) => projectName(targets, id)).join(", ")
                    : "—"}
                </dd>
              </>
            )}
          </dl>

          <div>
            <span className="asv-label">{t("arsenal:arsenalContent")}</span>
            <pre className="asv-body">{entry.body}</pre>
          </div>
          <div className="asv-actions">
            <CopyButton text={entry.body} label={t("arsenal:arsenalCopyContent")} primary />
          </div>

          {entry.kind === "skill" && (
            <>
              <section aria-label={t("arsenal:arsenalTemplatesAria")}>
                <span className="asv-label">{t("arsenal:arsenalTemplates")}</span>
                {entry.templates.length === 0 ? (
                  <p className="asv-empty">{t("arsenal:arsenalNoTemplates")}</p>
                ) : (
                  <ul className="asv-templates">
                    {entry.templates.map((template) => (
                      <li key={template.name}>
                        <span>{template.name}</span>
                        <CopyButton text={template.text} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section aria-label={t("arsenal:arsenalDeploymentsAria")}>
                <span className="asv-label">{t("arsenal:arsenalDeployments")}</span>
                {entry.deployed.length === 0 ? (
                  <p className="asv-empty">{t("arsenal:arsenalNotDeployedAnywhere")}</p>
                ) : (
                  <ul className="asv-deployed">
                    {entry.deployed.map((d) => (
                      <li key={d.project}>
                        <span>{projectName(targets, d.project)}</span> · {modeLabel(d.mode, t)} ·{" "}
                        {d.date}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <DeployPanel
                key={entry.id}
                skill={entry}
                targets={targets}
                fetchInstructions={fetchInstructions}
                markDeployed={markDeployed}
              />
            </>
          )}
        </>
      )}
    </aside>
  );
}
