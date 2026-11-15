import React, { useState } from "react";
import type { AgentEntryDto, AgentEntryInputDto } from "@/contexts/bc_arsenal/schemas";
import { useT } from "@/src/i18n/useT";
import { messageOf } from "./apiError";

type Kind = AgentEntryDto["kind"];

const KIND_KEY = {
  agent: "agents:kindAgent",
  preset: "agents:kindPreset",
  script: "agents:kindScript",
} as const;

type Props = {
  kind: Kind;
  initial?: AgentEntryDto;
  onSubmit: (input: AgentEntryInputDto) => Promise<void>;
  onCancel: () => void;
};

const textOf = (initial: AgentEntryDto | undefined, key: string): string => {
  const value = initial === undefined ? undefined : (initial as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
};

export function AgentEntryForm({ kind, initial, onSubmit, onCancel }: Props) {
  const t = useT();
  const [values, setValues] = useState<Record<string, string>>(() => ({
    name: textOf(initial, "name"),
    role: textOf(initial, "role"),
    model: textOf(initial, "model"),
    when: textOf(initial, "when"),
    command: textOf(initial, "command"),
    description: textOf(initial, "description"),
    path: textOf(initial, "path"),
    example: textOf(initial, "example"),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const build = (): AgentEntryInputDto => {
    const v = values;
    if (kind === "agent") return { kind, name: v.name, role: v.role, model: v.model, when: v.when };
    if (kind === "preset")
      return { kind, name: v.name, command: v.command, description: v.description };
    return { kind, name: v.name, path: v.path, description: v.description, example: v.example };
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(build());
    } catch (err) {
      setError(messageOf(err));
      setSaving(false);
    }
  };

  const field = (
    key: string,
    label: string,
    opts: { required?: boolean; multiline?: boolean } = {}
  ) => (
    <label className="crs-field">
      <span>{label}</span>
      {opts.multiline ? (
        <textarea rows={2} required={opts.required} value={values[key]} onChange={set(key)} />
      ) : (
        <input required={opts.required} value={values[key]} onChange={set(key)} />
      )}
    </label>
  );

  return (
    <form className="crs-form" onSubmit={submit}>
      <h3 className="crs-form__title">
        {t(initial === undefined ? "agents:formAddTitle" : "agents:formEditTitle", {
          kind: t(KIND_KEY[kind]),
        })}
      </h3>
      {field("name", t("agents:fieldName"), { required: true })}
      {kind === "agent" && (
        <>
          {field("role", t("agents:fieldRole"), { required: true })}
          {field("model", t("agents:fieldModel"))}
          {field("when", t("agents:fieldWhen"), { multiline: true })}
        </>
      )}
      {kind === "preset" && (
        <>
          {field("command", t("agents:fieldCommand"), { required: true, multiline: true })}
          {field("description", t("agents:fieldDescription"))}
        </>
      )}
      {kind === "script" && (
        <>
          {field("path", t("agents:fieldPath"), { required: true })}
          {field("description", t("agents:fieldDescription"))}
          {field("example", t("agents:fieldExample"), { multiline: true })}
        </>
      )}
      {error !== null && (
        <p role="alert" className="asv-error">
          {error}
        </p>
      )}
      <div className="crs-form__actions">
        <button type="submit" className="asv-btn asv-btn--primary" disabled={saving}>
          {t("agents:save")}
        </button>
        <button type="button" className="asv-btn" onClick={onCancel}>
          {t("agents:cancel")}
        </button>
      </div>
    </form>
  );
}
