import React, { useState } from "react";
import {
  COURSE_STATUSES,
  type CourseDto,
  type CourseInputDto,
} from "@/contexts/bc_arsenal/schemas";
import { useT } from "@/src/i18n/useT";
import { messageOf } from "./apiError";

const STATUS_KEY = {
  plan: "courses:statusPlan",
  "w-trakcie": "courses:statusInProgress",
  ukonczony: "courses:statusDone",
} as const;

type Props = {
  initial?: CourseDto;
  onSubmit: (input: CourseInputDto) => Promise<void>;
  onCancel: () => void;
};

export function CourseForm({ initial, onSubmit, onCancel }: Props) {
  const t = useT();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [provider, setProvider] = useState(initial?.provider ?? "");
  const [status, setStatus] = useState<CourseInputDto["status"]>(initial?.status ?? "plan");
  const [completed, setCompleted] = useState(initial?.completed ?? "");
  const [certificateUrl, setCertificateUrl] = useState(initial?.certificateUrl ?? "");
  const [certificateFile, setCertificateFile] = useState(initial?.certificateFile ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title,
        url,
        provider,
        status,
        completed: status === "ukonczony" ? completed : "",
        certificateUrl,
        certificateFile,
        note,
      });
    } catch (err) {
      setError(messageOf(err));
      setSaving(false);
    }
  };

  return (
    <form className="crs-form" onSubmit={submit}>
      <h2 className="crs-form__title">
        {t(initial === undefined ? "courses:formAddTitle" : "courses:formEditTitle")}
      </h2>
      <label className="crs-field">
        <span>{t("courses:fieldTitle")}</span>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="crs-field">
        <span>{t("courses:fieldUrl")}</span>
        <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
      <label className="crs-field">
        <span>{t("courses:fieldProvider")}</span>
        <input value={provider} onChange={(e) => setProvider(e.target.value)} />
      </label>
      <label className="crs-field">
        <span>{t("courses:fieldStatus")}</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          {COURSE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(STATUS_KEY[s])}
            </option>
          ))}
        </select>
      </label>
      {status === "ukonczony" && (
        <label className="crs-field">
          <span>{t("courses:fieldCompleted")}</span>
          <input type="date" value={completed} onChange={(e) => setCompleted(e.target.value)} />
        </label>
      )}
      <label className="crs-field">
        <span>{t("courses:fieldCertificateUrl")}</span>
        <input
          type="url"
          value={certificateUrl}
          onChange={(e) => setCertificateUrl(e.target.value)}
        />
      </label>
      <label className="crs-field">
        <span>{t("courses:fieldCertificateFile")}</span>
        <input value={certificateFile} onChange={(e) => setCertificateFile(e.target.value)} />
        <small className="crs-hint">{t("courses:fieldCertificateFileHint")}</small>
      </label>
      <label className="crs-field">
        <span>{t("courses:fieldNote")}</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error !== null && (
        <p role="alert" className="asv-error">
          {error}
        </p>
      )}
      <div className="crs-form__actions">
        <button type="submit" className="asv-btn asv-btn--primary" disabled={saving}>
          {t("courses:save")}
        </button>
        <button type="button" className="asv-btn" onClick={onCancel}>
          {t("courses:cancel")}
        </button>
      </div>
    </form>
  );
}
