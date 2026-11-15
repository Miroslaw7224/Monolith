import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import type {
  AgentEntryDto,
  AgentEntryInputDto,
  AgentRowDto,
  PresetRowDto,
  ScriptRowDto,
} from "@/contexts/bc_arsenal/schemas";
import { useT } from "@/src/i18n/useT";
import "@/src/features/resources/resources.css";
import "./arsenal.css";
import { AgentEntryForm } from "./AgentEntryForm";
import { ArsenalConfirmDialog } from "./ArsenalConfirmDialog";
import { CopyButton } from "./CopyButton";
import { messageOf } from "./apiError";
import type { ApiFetch } from "./useArsenal";
import { useAgents } from "./useAgents";

type Kind = AgentEntryDto["kind"];
/** `id` wpisu w edycji albo `new:<rodzaj>` dla nowego. */
type Editing = string | null;

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const t = useT();
  return (
    <div className="crs-card__actions">
      <button type="button" className="asv-btn" onClick={onEdit}>
        {t("agents:edit")}
      </button>
      <button type="button" className="asv-btn" onClick={onDelete}>
        {t("agents:delete")}
      </button>
    </div>
  );
}

export function AgentsView({ apiFetch }: { apiFetch: ApiFetch }) {
  const t = useT();
  const a = useAgents(apiFetch);
  const [editing, setEditing] = useState<Editing>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const total = a.agents.length + a.presets.length + a.scripts.length;
  const save = async (input: AgentEntryInputDto, id?: string) => {
    setActionError(null);
    await a.save(input, id);
    setEditing(null);
  };
  const [pendingDelete, setPendingDelete] = useState<AgentEntryDto | null>(null);
  const remove = async (entry: AgentEntryDto) => {
    setPendingDelete(null);
    setActionError(null);
    try {
      await a.remove(entry.id);
    } catch (err) {
      setActionError(messageOf(err));
    }
  };
  const formFor = (kind: Kind, entry?: AgentEntryDto) => (
    <AgentEntryForm
      key={entry?.id ?? `new:${kind}`}
      kind={kind}
      initial={entry}
      onSubmit={(input) => save(input, entry?.id)}
      onCancel={() => setEditing(null)}
    />
  );
  const rowOrForm = (entry: AgentEntryDto, row: React.ReactNode) =>
    editing === entry.id ? formFor(entry.kind, entry) : row;

  const section = (
    kind: Kind,
    title: string,
    addLabel: string,
    emptyText: string,
    rows: React.ReactNode[]
  ) => (
    <section className="ag-section" aria-label={title}>
      <div className="ag-section__head">
        <h2 className="ag-section__title">{title}</h2>
        <button type="button" className="asv-btn" onClick={() => setEditing(`new:${kind}`)}>
          {addLabel}
        </button>
      </div>
      {editing === `new:${kind}` && formFor(kind)}
      {rows.length === 0 && editing !== `new:${kind}` ? (
        <p className="asv-empty">{emptyText}</p>
      ) : (
        <div className="crs-list">{rows}</div>
      )}
    </section>
  );

  const agentRow = (e: AgentRowDto) =>
    rowOrForm(
      e,
      <article key={e.id} className="crs-card ag-card" data-kind="agent">
        <div className="crs-card__head">
          <span className="crs-card__title">{e.name}</span>
          {e.model !== undefined && <span className="asv-chip-static">{e.model}</span>}
        </div>
        <p className="crs-card__meta">{e.role}</p>
        {e.when !== undefined && <p className="crs-card__note">{e.when}</p>}
        <RowActions onEdit={() => setEditing(e.id)} onDelete={() => setPendingDelete(e)} />
      </article>
    );

  const presetRow = (e: PresetRowDto) =>
    rowOrForm(
      e,
      <article key={e.id} className="crs-card ag-card" data-kind="preset">
        <div className="crs-card__head">
          <span className="crs-card__title">{e.name}</span>
        </div>
        {e.description !== undefined && <p className="crs-card__meta">{e.description}</p>}
        <pre className="ag-code">{e.command}</pre>
        <div className="crs-card__actions">
          <CopyButton text={e.command} label={t("agents:copyCommand")} primary />
          <RowActions onEdit={() => setEditing(e.id)} onDelete={() => setPendingDelete(e)} />
        </div>
      </article>
    );

  const scriptRow = (e: ScriptRowDto) =>
    rowOrForm(
      e,
      <article key={e.id} className="crs-card ag-card" data-kind="script">
        <div className="crs-card__head">
          <span className="crs-card__title">{e.name}</span>
          <code className="ag-path">{e.path}</code>
        </div>
        {e.description !== undefined && <p className="crs-card__meta">{e.description}</p>}
        {e.example !== undefined && <pre className="ag-code">{e.example}</pre>}
        <div className="crs-card__actions">
          {e.example !== undefined && (
            <CopyButton text={e.example} label={t("agents:copyExample")} primary />
          )}
          <RowActions onEdit={() => setEditing(e.id)} onDelete={() => setPendingDelete(e)} />
        </div>
      </article>
    );

  return (
    <div className="ars asv" data-card="arsenal">
      <header className="ars-head">
        <div>
          <p className="ars-eyebrow">{`Alt+7 · ${t("shell:cards.arsenal")}`}</p>
          <h1 className="ars-title">{t("agents:title")}</h1>
          <p className="ars-sub">
            {t("agents:count", { count: total })}
            {a.skipped > 0 ? t("agents:skippedSuffix", { count: a.skipped }) : ""}
          </p>
        </div>
      </header>

      {a.loading ? (
        <Loader2 className="animate-spin" aria-label={t("agents:loading")} />
      ) : a.error !== null ? (
        <p role="alert" className="asv-error">
          {a.error}
        </p>
      ) : (
        <>
          <p className="asv-hint">{t("agents:copyHint")}</p>
          {actionError !== null && (
            <p role="alert" className="asv-error">
              {actionError}
            </p>
          )}
          {section(
            "agent",
            t("agents:sectionAgents"),
            t("agents:addAgent"),
            t("agents:emptyAgents"),
            a.agents.map(agentRow)
          )}
          {section(
            "preset",
            t("agents:sectionPresets"),
            t("agents:addPreset"),
            t("agents:emptyPresets"),
            a.presets.map(presetRow)
          )}
          {section(
            "script",
            t("agents:sectionScripts"),
            t("agents:addScript"),
            t("agents:emptyScripts"),
            a.scripts.map(scriptRow)
          )}
        </>
      )}
      {pendingDelete && (
        <ArsenalConfirmDialog
          title={t("agents:deleteConfirm", { name: pendingDelete.name })}
          confirmLabel={t("common:delete")}
          cancelLabel={t("common:cancel")}
          onConfirm={() => void remove(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
