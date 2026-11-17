"use client";

import React, { useMemo, useState } from "react";
import type { PortListenerDto } from "@/contexts/bc_diagnostics/schemas";
import { formatTimeSeconds } from "@/src/i18n/format";
import { useT } from "@/src/i18n/useT";
import { useDiagnostics, type ApiFetch } from "./useDiagnostics";
import "./diagnostics.css";

type SortKey = "port" | "process" | "source";

function matches(p: PortListenerDto, q: string): boolean {
  if (q === "") return true;
  return (
    String(p.port).includes(q) ||
    p.process.toLowerCase().includes(q) ||
    (p.project?.name.toLowerCase().includes(q) ?? false)
  );
}

function sortRows(rows: PortListenerDto[], key: SortKey): PortListenerDto[] {
  const cmp = (a: PortListenerDto, b: PortListenerDto): number =>
    key === "process"
      ? a.process.localeCompare(b.process) || a.port - b.port
      : key === "source"
        ? a.source.localeCompare(b.source) || a.port - b.port
        : a.port - b.port || a.source.localeCompare(b.source);
  return [...rows].sort(cmp);
}

export function DiagnosticsView({ apiFetch }: { apiFetch: ApiFetch }) {
  const t = useT();
  const { data, error, loading, reload } = useDiagnostics(apiFetch);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("port");
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState<{ key: string; ok: boolean } | null>(null);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => (data?.ports ?? []).filter((p) => showAll || p.relevant),
    [data, showAll]
  );
  const hiddenCount = (data?.ports.length ?? 0) - visible.length;
  const rows = useMemo(
    () =>
      sortRows(
        visible.filter((p) => matches(p, q)),
        sort
      ),
    [visible, q, sort]
  );

  const copy = async (key: string, text: string) => {
    let ok = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      ok = false;
    }
    setCopied({ key, ok });
    setTimeout(() => setCopied((c) => (c?.key === key ? null : c)), 1500);
  };

  const failures = (["wsl", "windows"] as const).flatMap((name) => {
    const s = data?.sources[name];
    return s && s.ok === false ? [{ name, reason: s.reason }] : [];
  });

  return (
    <section className="diag-root" aria-labelledby="diag-title">
      <header className="diag-head">
        <div>
          <h1 id="diag-title">{t("diagnostics:title")}</h1>
          <p className="diag-sub">{t("diagnostics:subtitle")}</p>
        </div>
        <div className="diag-tools">
          <input
            type="search"
            className="diag-filter"
            aria-label={t("diagnostics:filterAria")}
            placeholder={t("diagnostics:filterPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="diag-sort"
            aria-label={t("diagnostics:columns.port")}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="port">{t("diagnostics:columns.port")}</option>
            <option value="process">{t("diagnostics:columns.process")}</option>
            <option value="source">{t("diagnostics:columns.source")}</option>
          </select>
          <label className="diag-check">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            {t("diagnostics:showAll")}
          </label>
          <button
            type="button"
            className="diag-btn"
            onClick={() => void reload()}
            disabled={loading}
          >
            {loading ? t("diagnostics:refreshing") : t("diagnostics:refresh")}
          </button>
        </div>
      </header>

      {error ? (
        <p role="alert" className="diag-alert">
          {t("diagnostics:error", { message: error })}
        </p>
      ) : null}
      {failures.map((f) => (
        <p key={f.name} role="status" className="diag-alert diag-alert--warn">
          {t(`diagnostics:sourceFailed.${f.reason}`, { source: t(`diagnostics:source.${f.name}`) })}
        </p>
      ))}

      {data ? (
        <p className="diag-meta">
          {t("diagnostics:total", { count: rows.length })}
          {hiddenCount > 0 ? ` · ${t("diagnostics:hidden", { count: hiddenCount })}` : ""} ·{" "}
          {t("diagnostics:generatedAt", { time: formatTimeSeconds(new Date(data.generatedAt)) })}
        </p>
      ) : loading ? (
        <p className="diag-meta">{t("diagnostics:loading")}</p>
      ) : null}

      {data && rows.length === 0 ? (
        <p className="diag-empty">
          {data.ports.length === 0
            ? t("diagnostics:empty")
            : q === "" && !showAll
              ? t("diagnostics:emptyHidden")
              : t("diagnostics:emptyFiltered")}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="diag-scroll">
          <table className="diag-table">
            <thead>
              <tr>
                <th>{t("diagnostics:columns.port")}</th>
                <th>{t("diagnostics:columns.source")}</th>
                <th>{t("diagnostics:columns.address")}</th>
                <th>{t("diagnostics:columns.process")}</th>
                <th>{t("diagnostics:columns.pid")}</th>
                <th>{t("diagnostics:columns.action")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const key = `${p.source}|${p.pid}|${p.port}`;
                const state = copied?.key === key ? copied : null;
                return (
                  <tr key={key} data-warning={p.warning ?? undefined}>
                    <td className="diag-port">{p.port}</td>
                    <td>{t(`diagnostics:source.${p.source}`)}</td>
                    <td>
                      {p.addresses.map((a) => (
                        <code key={a} className="diag-addr">
                          {a}
                        </code>
                      ))}{" "}
                      <span className={`diag-chip diag-chip--${p.exposure}`}>
                        {t(`diagnostics:exposure.${p.exposure}`)}
                      </span>
                    </td>
                    <td title={p.commandLine ?? p.path ?? undefined}>
                      {p.project ? (
                        <>
                          <strong className="diag-project">{p.project.name}</strong>
                          {" · "}
                        </>
                      ) : null}
                      {p.process === "" ? t("diagnostics:unknownProcess") : p.process}
                      {p.warning ? (
                        <span className="diag-chip diag-chip--warn">
                          {t(`diagnostics:warning.${p.warning}`)}
                        </span>
                      ) : null}
                    </td>
                    <td>{p.pid ?? "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="diag-btn diag-btn--sm"
                        disabled={p.killCommand === null}
                        title={p.killCommand ?? t("diagnostics:kill.noPid")}
                        onClick={() => p.killCommand && void copy(key, p.killCommand)}
                      >
                        {t("diagnostics:kill.copy")}
                      </button>
                      {state ? (
                        <span role="status" className="diag-copied">
                          {state.ok ? t("diagnostics:kill.copied") : t("diagnostics:kill.failed")}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
