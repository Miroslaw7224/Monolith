import React, { useRef, useState } from "react";
import type {
  DeployInstructionsDto,
  DeployModeDto,
  DeployTargetDto,
  SkillEntryDto,
} from "@/contexts/bc_arsenal/schemas";
import i18n from "@/src/i18n";
import { useT } from "@/src/i18n/useT";
import { CopyButton } from "./CopyButton";

type Props = {
  skill: SkillEntryDto;
  targets: DeployTargetDto[];
  fetchInstructions: (
    slug: string,
    project: string,
    mode: DeployModeDto
  ) => Promise<DeployInstructionsDto>;
  markDeployed: (slug: string, project: string, mode: DeployModeDto) => Promise<void>;
};

const message = (err: unknown): string =>
  err instanceof Error ? err.message : i18n.t("arsenal:arsenalErrorGeneric");

export function DeployPanel({ skill, targets, fetchInstructions, markDeployed }: Props) {
  const t = useT();
  const [project, setProject] = useState(targets[0]?.id ?? "");
  const [mode, setMode] = useState<DeployModeDto>("full");
  const [result, setResult] = useState<DeployInstructionsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [marked, setMarked] = useState(false);
  /** Numer ostatniego żądania; zmiana projektu/trybu unieważnia żądania w locie. */
  const request = useRef(0);

  if (targets.length === 0) {
    return <p className="asv-empty">{t("arsenal:arsenalNoProjects")}</p>;
  }

  const reset = () => {
    request.current += 1;
    setResult(null);
    setError(null);
    setMarked(false);
    setBusy(false);
  };

  const generate = async () => {
    const id = request.current + 1;
    reset();
    request.current = id;
    setBusy(true);
    try {
      const out = await fetchInstructions(skill.slug, project, mode);
      if (request.current === id) setResult(out);
    } catch (err) {
      if (request.current === id) setError(message(err));
    } finally {
      if (request.current === id) setBusy(false);
    }
  };

  const mark = async () => {
    setBusy(true);
    setError(null);
    try {
      await markDeployed(skill.slug, project, mode);
      setMarked(true);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="asv-deploy" aria-label={t("arsenal:arsenalDeployAria")}>
      <h3>{t("arsenal:arsenalDeployTitle")}</h3>
      <label>
        {t("arsenal:arsenalDeployTarget")}
        <select
          value={project}
          onChange={(e) => {
            setProject(e.target.value);
            reset();
          }}
        >
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.name}
              {target.companyData ? " (etat)" : ""}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="asv-modes">
        <legend>{t("arsenal:arsenalDeployMode")}</legend>
        <label>
          <input
            type="radio"
            name={`mode-${skill.slug}`}
            checked={mode === "full"}
            onChange={() => {
              setMode("full");
              reset();
            }}
          />
          {t("arsenal:arsenalModeFull")}
        </label>
        <label>
          <input
            type="radio"
            name={`mode-${skill.slug}`}
            checked={mode === "adapted"}
            onChange={() => {
              setMode("adapted");
              reset();
            }}
          />
          {t("arsenal:arsenalModeAdapted")}
        </label>
      </fieldset>
      <button type="button" className="asv-btn" disabled={busy} onClick={generate}>
        {t("arsenal:arsenalDeployGenerate")}
      </button>
      {error !== null && (
        <p role="alert" className="asv-error">
          {error}
        </p>
      )}
      {result !== null && (
        <div className="asv-result">
          {result.note !== undefined && <p className="asv-note">{result.note}</p>}
          {result.mode === "full" && (
            <p className="asv-hint">{t("arsenal:arsenalDeployFullHint")}</p>
          )}
          <pre className="asv-body">{result.text}</pre>
          <div className="asv-actions">
            <CopyButton text={result.text} />
            <button type="button" className="asv-btn" disabled={busy} onClick={mark}>
              {t("arsenal:arsenalDeployMark")}
            </button>
            {marked && <span className="asv-ok">{t("arsenal:arsenalDeployMarked")}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
