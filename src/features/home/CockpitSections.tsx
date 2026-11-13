// src/features/home/CockpitSections.tsx
import React, { useRef, useState } from "react";
import type {
  CockpitDto,
  DayEventDto,
  QueueGroupDto,
  TopicDto,
} from "@/contexts/bc_cockpit/schemas";
import { hhmm, minutesUntil, relativeDays, timelineRange } from "./cockpitFormat";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === "") return null;
  return (
    <>
      <dt>{label}</dt>
      <dd title={typeof value === "string" ? value : undefined}>{value}</dd>
    </>
  );
}

type CopyState = "idle" | "ok" | "error";

function TopicCard({
  topic,
  lead,
  now,
  apiFetch,
  onOpenProject,
}: {
  topic: TopicDto;
  lead: boolean;
  now: Date;
  apiFetch: ApiFetch;
  onOpenProject: (id: string) => void;
}) {
  const [copy, setCopy] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyContext = async () => {
    try {
      const res = await apiFetch(`/api/projects/${encodeURIComponent(topic.id)}/context-pack`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const pack = (await res.json()) as { markdown: string };
      await navigator.clipboard.writeText(pack.markdown);
      setCopy("ok");
    } catch {
      setCopy("error");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopy("idle"), 2000);
  };

  const last = relativeDays(topic.lastActivity, now);
  const hasBlocker = topic.source === "state" && topic.blocker !== null;

  return (
    <article
      className={`kok-topic kok-panel${lead ? " kok-topic--lead" : ""}`}
      aria-label={`Temat ${topic.name}`}
    >
      <div className="kok-topic__head">
        <h4 className="kok-topic__name">{topic.name}</h4>
        <div className="kok-topic__badges">
          {hasBlocker ? <span className="kok-badge kok-badge--danger">bloker</span> : null}
          {!hasBlocker && topic.confidence === "sure" && topic.source === "state" ? (
            <span className="kok-badge kok-badge--ok">aktywny</span>
          ) : null}
          {topic.owner === "work" ? (
            <span className="kok-badge kok-badge--warn">Dane z firmy</span>
          ) : (
            <span className="kok-badge">własny</span>
          )}
        </div>
      </div>

      {topic.source === "state" && topic.nextStep ? (
        <p className="kok-topic__next">
          <span>{topic.nextStep}</span>
        </p>
      ) : null}
      {topic.source === "none" ? <p className="kok-topic__empty">Brak zapisanego stanu</p> : null}

      <dl className="kok-kv">
        {topic.source === "index" ? (
          <Line label="Gdzie skończyłem" value={topic.whereIStopped} />
        ) : null}
        <Line label="Branch" value={topic.branch} />
        <Line label="Bloker" value={hasBlocker ? topic.blocker : null} />
        {last ? (
          <Line
            label="Ostatnio"
            value={
              <>
                {last}{" "}
                <span
                  className={`kok-chip ${topic.confidence === "sure" ? "kok-chip--ok" : "kok-chip--warn"}`}
                >
                  {topic.confidence === "sure" ? "pewne" : "do sprawdzenia"}
                </span>
              </>
            }
          />
        ) : null}
      </dl>

      <div className="kok-topic__foot">
        <span className="kok-topic__chips">
          {topic.nowCount > 0 ? <span className="kok-chip">Teraz: {topic.nowCount}</span> : null}
          {topic.bugCount > 0 ? <span className="kok-chip">bugi: {topic.bugCount}</span> : null}
        </span>
        <span className="kok-topic__actions">
          <button type="button" className="kok-btn kok-btn--sm" onClick={copyContext}>
            {copy === "ok"
              ? "Skopiowano"
              : copy === "error"
                ? "Nie udało się skopiować"
                : "Kopiuj kontekst"}
          </button>
          <button
            type="button"
            className="kok-btn kok-btn--sm kok-btn--primary"
            onClick={() => onOpenProject(topic.id)}
          >
            Wejdź
          </button>
        </span>
      </div>
    </article>
  );
}

function QueueGroupCard({ group }: { group: QueueGroupDto }) {
  return (
    <section className="kok-group" aria-label={`Kolejka: ${group.name}`}>
      <div className="kok-group__head">
        <h4 className="kok-group__title">{group.name}</h4>
        {group.owner === "work" ? (
          <span className="kok-badge kok-badge--warn">Dane z firmy</span>
        ) : null}
      </div>
      <ul className="kok-list">
        {group.items.map((item, i) => (
          <li key={`${item.kind}-${i}`} className="kok-list__item">
            <input
              className="kok-check"
              type="checkbox"
              aria-label="zrobione"
              checked={false}
              readOnly
            />
            <span className="kok-list__title">
              {item.title}
              {item.projectName && item.priority ? (
                <small className="kok-list__sub">
                  {item.projectName} · {item.priority}
                </small>
              ) : null}
            </span>
            {item.kind === "overdue" && item.due ? (
              <span className="kok-badge kok-badge--danger">{item.due}</span>
            ) : null}
            {item.kind === "today" ? (
              <span className="kok-badge kok-badge--accent">dziś</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EventRow({ event, current }: { event: DayEventDto; current: boolean }) {
  return (
    <li className={`kok-tl__item${current ? " kok-tl__item--current" : ""}`}>
      <span className="kok-tl__time">{hhmm(event.startMinutes)}</span>
      <span className="kok-tl__node" />
      <div className="kok-tl__body">
        <div className="kok-tl__title">{event.title}</div>
        <div className="kok-tl__meta">
          <span className="kok-chip">{event.durationMinutes} min</span>
          {event.type ? <span className="kok-chip">{event.type}</span> : null}
        </div>
      </div>
    </li>
  );
}

function NowMarker({ nowMinutes }: { nowMinutes: number }) {
  return (
    <li className="kok-tl__now" aria-label={`Teraz ${hhmm(nowMinutes)}`}>
      <span>teraz</span>
      <i />
    </li>
  );
}

function Timeline({ events, now }: { events: DayEventDto[]; now: Date }) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const items: React.ReactNode[] = [];
  let markerPlaced = false;
  for (const event of events) {
    if (!markerPlaced && event.startMinutes > nowMinutes) {
      items.push(<NowMarker key="now" nowMinutes={nowMinutes} />);
      markerPlaced = true;
    }
    const current =
      event.startMinutes <= nowMinutes && nowMinutes < event.startMinutes + event.durationMinutes;
    items.push(<EventRow key={event.id} event={event} current={current} />);
  }
  if (!markerPlaced) items.push(<NowMarker key="now" nowMinutes={nowMinutes} />);
  return <ol className="kok-tl">{items}</ol>;
}

export function CockpitSections({
  data,
  now,
  apiFetch,
  onChangeActive,
  onOpenProject,
}: {
  data: CockpitDto;
  now: Date;
  apiFetch: ApiFetch;
  onChangeActive: () => void;
  onOpenProject: (id: string) => void;
}) {
  const totalQueueTasks = data.queue.reduce((acc, g) => acc + g.items.length, 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const range = timelineRange(data.events);
  const next = data.nextMeeting;
  const free = 3 - data.topics.length;

  return (
    <>
      <section className="kok-tiles tiles" aria-label="Liczby dnia">
        <div className="kok-tile kok-tile--accent tile tile--accent">
          <span className="kok-tile__label">Następne spotkanie</span>
          <span className="kok-tile__value">{next ? hhmm(next.startMinutes) : "—"}</span>
          <span className="kok-tile__meta">
            {next
              ? next.startMinutes <= nowMinutes
                ? `trwa · ${next.title}`
                : `za ${minutesUntil(nowMinutes, next.startMinutes)} min · ${next.title}`
              : "brak spotkań dziś"}
          </span>
        </div>
        <div className="kok-tile tile">
          <span className="kok-tile__label">Kolejka zadań</span>
          <span className="kok-tile__value">{totalQueueTasks}</span>
          <span className="kok-tile__meta">{data.queue.length} grup projektowych</span>
        </div>
        <div className="kok-tile tile">
          <span className="kok-tile__label">Aktywne tematy</span>
          <span className="kok-tile__value">
            {data.topics.length}
            <span className="kok-tile__sub"> / 3</span>
          </span>
          <span className="kok-tile__meta">
            {free === 0
              ? "limit 3 tematy"
              : free === 3
                ? "przypnij projekty"
                : free === 1
                  ? "jedno wolne miejsce"
                  : "dwa wolne miejsca"}
          </span>
        </div>
        <div className="kok-tile tile">
          <span className="kok-tile__label">Ostrzeżenia</span>
          <span className="kok-tile__value">{data.warnings.length}</span>
          <span className="kok-tile__meta">
            {data.warnings.length === 0 ? "stan spójny" : "wpisy wymagające uwagi"}
          </span>
        </div>
      </section>

      <div className="kok-grid">
        <section className="kok-panel" aria-label="Oś dnia">
          <div className="kok-panel__head">
            <h3 className="kok-panel__title">
              <b>Dziś</b> · oś czasu
            </h3>
            <span className="kok-chip">
              {String(range.from).padStart(2, "0")}–{String(range.to).padStart(2, "0")}
            </span>
          </div>
          {data.events.length === 0 ? (
            <p className="kok-empty-msg">Brak wydarzeń na dziś</p>
          ) : (
            <Timeline events={data.events} now={now} />
          )}
        </section>

        <section className="kok-focus" aria-label="Aktywne tematy">
          <div className="kok-panel__head">
            <h3 className="kok-panel__title">
              <b>Punkty skupienia</b> · Save State
            </h3>
            <span className="kok-focus__limit">limit 3</span>
            <button
              type="button"
              onClick={onChangeActive}
              className="kok-btn kok-btn--sm kok-btn--ghost"
            >
              Zmień aktywne
            </button>
          </div>
          {data.topics.length === 0 ? (
            <p className="kok-empty-msg">Przypnij projekty</p>
          ) : (
            data.topics.map((topic, i) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                lead={i === 0}
                now={now}
                apiFetch={apiFetch}
                onOpenProject={onOpenProject}
              />
            ))
          )}
          {free > 0 ? (
            <button className="kok-empty" type="button" onClick={onChangeActive}>
              <span>
                {free === 1 ? "Wolne miejsce na trzeci temat" : "Wolne miejsce na kolejny temat"}
              </span>
              <span className="kok-kbd">+</span>
            </button>
          ) : null}
        </section>

        <section className="kok-panel kok-queue" aria-label="Kolejka na dziś">
          <div className="kok-panel__head">
            <h3 className="kok-panel__title">
              <b>Kolejka</b> · dziś
            </h3>
            <span className="kok-chip">{totalQueueTasks} zadań</span>
          </div>
          {data.queue.length === 0 ? (
            <p className="kok-empty-msg">Nic w kolejce</p>
          ) : (
            <div className="kok-queue">
              {data.queue.map((group) => (
                <QueueGroupCard key={group.projectId ?? "general"} group={group} />
              ))}
            </div>
          )}
        </section>
      </div>

      {data.warnings.length > 0 ? (
        <ul className="kok-warnings" aria-label="Ostrzeżenia">
          {data.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
