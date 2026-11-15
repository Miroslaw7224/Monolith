"use client";

import React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatFullDateTime, formatTimeSeconds } from "@/src/i18n/format";
import { useT } from "@/src/i18n/useT";
import { ChecklistPanel } from "./ChecklistPanel";
import { CodexAlerts } from "./CodexAlerts";
import { CheckIcon } from "./CodexIcons";
import { CodexRules, ruleElementId } from "./CodexRules";
import { CodexConfigError, CodexMissing } from "./CodexStates";
import { CodexToasts, useToasts } from "./CodexToast";
import { CodexToc } from "./CodexToc";
import { alertItems, countLevels, filterCodex, type LevelFilter } from "./codexFilters";
import { useChecklistRun, type OwnerZone } from "./useChecklistRun";
import { useCodex, type ApiFetch } from "./useCodex";
import "./codex.css";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CodexView({ apiFetch }: { apiFetch: ApiFetch }) {
  const t = useT();
  const { state, reload } = useCodex(apiFetch);
  const { toasts, push } = useToasts();
  const [level, setLevel] = useState<LevelFilter>("all");
  const [query, setQuery] = useState("");
  const [checklistId, setChecklistId] = useState("");
  const [owner, setOwner] = useState<OwnerZone>("personal");
  // Opis zadania jest osobny dla każdej strefy: tekst wpisany w `work` nie może trafić do `personal`.
  const [tasks, setTasks] = useState<Record<OwnerZone, string>>({ personal: "", work: "" });
  const task = tasks[owner];
  const setTask = (value: string) => setTasks((prev) => ({ ...prev, [owner]: value }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [pendingScroll, setPendingScroll] = useState<{
    elementId: string;
    ruleId: string | null;
  } | null>(null);

  const formatMtime = (ms: number) => formatFullDateTime(new Date(ms));

  const data = state.status === "ok" ? state.data : null;
  const checklists = useMemo(() => data?.checklists ?? [], [data]);
  const selected = checklists.find((c) => c.id === checklistId) ?? checklists[0];
  const itemIds = useMemo(() => selected?.items.map((item) => item.id) ?? [], [selected]);

  const runApi = useChecklistRun(apiFetch, {
    checklist: selected?.id ?? null,
    owner,
    task,
    itemIds,
  });

  const selectSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) {
      // sekcja ukryta przez filtr: czyścimy filtr i przewijamy po renderze
      setLevel("all");
      setQuery("");
      setPendingScroll({ elementId: id, ruleId: null });
      return;
    }
    setActiveId(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const jumpToRule = useCallback(
    (ruleId: string) => {
      const el = document.getElementById(ruleElementId(ruleId));
      if (!el) {
        // reguła ukryta przez filtr: czyścimy filtr i przewijamy po renderze
        setLevel("all");
        setQuery("");
        setPendingScroll({ elementId: ruleElementId(ruleId), ruleId });
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(ruleId);
      window.setTimeout(
        () => setHighlightId((current) => (current === ruleId ? null : current)),
        1800
      );
      push(t("codex:codexScrolledToRule", { id: ruleId }));
    },
    [push, t]
  );

  useEffect(() => {
    if (!pendingScroll || !document.getElementById(pendingScroll.elementId)) return;
    const { elementId, ruleId } = pendingScroll;
    setPendingScroll(null);
    if (ruleId) jumpToRule(ruleId);
    else selectSection(elementId);
  }, [pendingScroll, jumpToRule, selectSection, level, query]);

  const sectionIds = useMemo(() => data?.sections.map((s) => s.id) ?? [], [data]);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || sectionIds.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "0px 0px -70% 0px" }
    );
    for (const id of [...sectionIds, "sec-checklisty"]) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // `level` i `query` zmieniają zestaw wyrenderowanych sekcji, więc obserwator musi je zebrać od nowa.
  }, [sectionIds, level, query]);

  const copy = async (text: string, okMessage: string) => {
    push((await copyText(text)) ? okMessage : t("codex:codexCopyFailed"));
  };

  const refresh = async () => {
    const outcome = await reload();
    await runApi.reload();
    if (outcome === "error") push(t("codex:codexRefreshFailed"));
    else if (outcome === "changed") push(t("codex:codexRefreshChanged"));
    else push(t("codex:codexRefreshMtimeCurrent", { time: formatTimeSeconds(new Date()) }));
  };

  const body = (() => {
    if (state.status === "loading")
      return <p className="kod-text-block">{t("codex:codexLoading")}</p>;
    if (state.status === "error") {
      return (
        <p className="kod-error-inline" role="alert">
          {state.message}
        </p>
      );
    }
    if (state.status === "missing") {
      return (
        <CodexMissing
          path={state.path}
          onCopy={(text) => void copy(text, t("codex:codexCreateCopied"))}
        />
      );
    }
    if (state.status === "config-error") {
      return <CodexConfigError message={state.message} onRetry={() => void reload()} />;
    }
    const codex = state.data;
    const counts = countLevels(codex.rules);
    const journalName = runApi.month ? `${runApi.month}.jsonl` : null;
    const alerts = alertItems(
      codex.warnings,
      runApi.skippedLines,
      runApi.unterminatedTail,
      journalName
    );
    const sections = filterCodex(codex.sections, codex.rules, level, query);
    return (
      <>
        <div className="kod-filebar">
          <div className="kod-filebar__main">
            <span className="kod-filebar__badge">
              <CheckIcon />
              {t("codex:codexReadOnly")}
            </span>
            <span className="kod-filebar__path">Vault/{codex.path}</span>
            <span className="kod-filebar__mtime">
              mtime: <b>{formatMtime(codex.mtimeMs)}</b>
            </span>
          </div>
        </div>
        <div className="tiles kod-tiles">
          <div className="tile tile--accent">
            <span className="tile__label">{t("codex:codexTileRules")}</span>
            <span className="tile__value">{counts.all}</span>
            <span className="tile__meta">
              {t("codex:codexTileRulesMeta", { must: counts.must, should: counts.should })}
            </span>
          </div>
          <div className="tile">
            <span className="tile__label">{t("codex:codexTileChecklistRun")}</span>
            <span className="tile__value">{`${runApi.progress.done} / ${runApi.progress.total}`}</span>
            <span className="tile__meta">
              {selected?.title ?? "—"} ({runApi.progress.pct}%)
            </span>
          </div>
          <div className="tile">
            <span className="tile__label">{t("codex:codexTileEventLog")}</span>
            <span className="tile__value">{runApi.eventCount}</span>
            <span className="tile__meta">
              {journalName ?? "—"} · {t("codex:codexJournalAppending")}
            </span>
          </div>
          <div className="tile">
            <span className="tile__label">{t("codex:codexTileValidation")}</span>
            <span
              className="tile__value"
              style={alerts.length > 0 ? { color: "var(--warn)" } : undefined}
            >
              {alerts.length}
            </span>
            <span className="tile__meta">{t("codex:codexTileParserWarnings")}</span>
          </div>
        </div>
        <CodexAlerts items={alerts} />
        <div className="kod-layout">
          <CodexToc data={codex} activeId={activeId} onSelect={selectSection} />
          <CodexRules
            data={codex}
            sections={sections}
            level={level}
            query={query}
            highlightId={highlightId}
            onLevel={setLevel}
            onQuery={setQuery}
            onJump={jumpToRule}
          />
          {selected ? (
            <ChecklistPanel
              data={codex}
              selectedId={selected.id}
              onSelect={setChecklistId}
              owner={owner}
              onOwner={setOwner}
              task={task}
              onTask={setTask}
              runApi={runApi}
              onJump={jumpToRule}
              onToast={push}
            />
          ) : null}
        </div>
      </>
    );
  })();

  const eyebrow = `Alt+9 · ${t("shell:cards.kodeks")}`;

  return (
    <main className="kod-root" aria-label={t("codex:codexAria")}>
      <header className="view-head">
        <div>
          <p className="view-head__eyebrow">{eyebrow}</p>
          <h1 className="view-head__title">{data?.title || t("codex:codexFallbackTitle")}</h1>
          <p className="view-head__sub">
            {t("codex:codexSubtitleLead")}
            <code>Vault/Knowledge/kodeks.md</code>
            {t("codex:codexSubtitleTrail")}
          </p>
        </div>
        <div className="view-head__actions">
          <button type="button" className="btn btn--sm" onClick={() => void refresh()}>
            {t("codex:codexRefreshMtime")}
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => void copy("Vault/Knowledge/kodeks.md", t("codex:codexPathCopied"))}
          >
            {t("codex:codexCopyPath")}
          </button>
        </div>
      </header>
      {body}
      <CodexToasts toasts={toasts} />
    </main>
  );
}
