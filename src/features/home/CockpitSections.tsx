// src/features/home/CockpitSections.tsx
import React, { useRef, useState } from "react";
import type {
  CockpitDto,
  DayEventDto,
  QueueGroupDto,
  TopicDto,
} from "@/contexts/bc_cockpit/schemas";
import { InboxPanel } from "./InboxPanel";
import { CommitHistory } from "./CommitHistory";
import { hhmm, minutesUntil, projectsLabel, relativeDays, timelineRange } from "./cockpitFormat";

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

type EnergyFilter = "all" | "deep" | "quick";
const ENERGY_FILTERS: { value: EnergyFilter; label: string }[] = [
  { value: "all", label: "wszystko" },
  { value: "deep", label: "deep" },
  { value: "quick", label: "quick" },
];

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
            {item.energy ? (
              <span className={`kok-energy kok-energy--${item.energy}`}>{item.energy}</span>
            ) : null}
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
          {event.link ? (
            <a
              className="kok-btn kok-btn--sm"
              href={event.link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Dołącz do spotkania: ${event.title}`}
            >
              Dołącz ↗
            </a>
          ) : null}
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
  onInboxChanged,
  focusInbox,
  onInboxFocused,
}: {
  data: CockpitDto;
  now: Date;
  apiFetch: ApiFetch;
  onChangeActive: () => void;
  onOpenProject: (id: string) => void;
  onInboxChanged: () => void;
  focusInbox?: boolean;
  onInboxFocused?: () => void;
}) {
  const [energyFilter, setEnergyFilter] = useState<EnergyFilter>("all");
  const allItems = data.queue.flatMap((g) => g.items);
  const totalQueueTasks = allItems.length;
  const deepCount = allItems.filter((i) => i.energy === "deep").length;
  const quickCount = allItems.filter((i) => i.energy === "quick").length;
  const hasEnergy = deepCount + quickCount > 0;
  const visibleQueue = data.queue
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => energyFilter === "all" || i.energy === energyFilter),
    }))
    .filter((g) => g.items.length > 0);
  const visibleCount = visibleQueue.reduce((acc, g) => acc + g.items.length, 0);
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
          {next?.link ? (
            <a
              className="kok-btn kok-btn--sm kok-tile__join"
              href={next.link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Dołącz do spotkania: ${next.title}`}
            >
              Dołącz ↗
            </a>
          ) : null}
        </div>
        <div className="kok-tile tile">
          <span className="kok-tile__label">Kolejka zadań</span>
          <span className="kok-tile__value">{totalQueueTasks}</span>
          <span className="kok-tile__meta">
            {hasEnergy
              ? `${deepCount} deep · ${quickCount} quick`
              : `${data.queue.length} grup projektowych`}
          </span>
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
        {data.inbox ? (
          <div className="kok-tile tile">
            <span className="kok-tile__label">Inbox</span>
            <span className="kok-tile__value">{data.inbox.open}</span>
            <span className="kok-tile__meta">
              {data.inbox.open === 0 ? "pusto" : "do segregacji wieczorem"}
            </span>
          </div>
        ) : null}
        {data.git ? (
          <div className="kok-tile tile">
            <span className="kok-tile__label">Commity dziś</span>
            <span className="kok-tile__value">{data.git.commitsToday}</span>
            <span className="kok-tile__meta">{projectsLabel(data.git.projectsWithCommits)}</span>
          </div>
        ) : null}
      </section>

      <div className="kok-grid">
        <div className="kok-col">
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

          <CommitHistory apiFetch={apiFetch} />
        </div>

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

        <div className="kok-col">
          <section className="kok-panel kok-queue" aria-label="Kolejka na dziś">
            <div className="kok-panel__head">
              <h3 className="kok-panel__title">
                <b>Kolejka</b> · dziś
              </h3>
              <div className="kok-panel__tools">
                {hasEnergy
                  ? ENERGY_FILTERS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        className="kok-chip kok-chip--btn"
                        aria-pressed={energyFilter === f.value}
                        onClick={() => setEnergyFilter(f.value)}
                      >
                        {f.label}
                      </button>
                    ))
                  : null}
                <span className="kok-chip">{visibleCount} zadań</span>
              </div>
            </div>
            {data.queue.length === 0 ? (
              <p className="kok-empty-msg">Nic w kolejce</p>
            ) : visibleCount === 0 ? (
              <p className="kok-empty-msg">Brak zadań z tą energią</p>
            ) : (
              <div className="kok-queue">
                {visibleQueue.map((group) => (
                  <QueueGroupCard key={group.projectId ?? "general"} group={group} />
                ))}
              </div>
            )}
          </section>

          {data.inbox ? (
            <InboxPanel
              apiFetch={apiFetch}
              onChanged={onInboxChanged}
              focusRequest={focusInbox}
              onFocused={onInboxFocused}
            />
          ) : null}
        </div>
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
