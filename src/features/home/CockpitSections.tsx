// src/features/home/CockpitSections.tsx
import React, { useRef, useState } from "react";
import type {
  CockpitDto,
  DayEventDto,
  DeepWindowDto,
  QueueGroupDto,
  TopicDto,
} from "@/contexts/bc_cockpit/schemas";
import { EnergySwitch } from "./EnergySwitch";
import { InboxPanel } from "./InboxPanel";
import { QueueItemDialog } from "./QueueItemDialog";
import { CommitHistory } from "./CommitHistory";
import {
  briefLines,
  hhmm,
  meetingDayLabel,
  minutesUntil,
  projectsLabel,
  relativeDays,
  upcomingWindows,
} from "./cockpitFormat";

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

const QUEUE_LIMIT = 8;

type EnergyFilter = "all" | "deep" | "quick";
const ENERGY_FILTERS: { value: EnergyFilter; label: string }[] = [
  { value: "all", label: "wszystko" },
  { value: "deep", label: "deep" },
  { value: "quick", label: "quick" },
];

const sourceKey = (item: QueueGroupDto["items"][number]) =>
  item.source.type === "task"
    ? `task:${item.source.taskId}`
    : `project:${item.source.projectId}:${item.source.occurrence}:${item.source.text}`;

function QueueGroupCard({
  group,
  busyKey,
  onComplete,
  onSetEnergy,
  onPreview,
}: {
  group: QueueGroupDto;
  busyKey: string | null;
  onComplete: (item: QueueGroupDto["items"][number]) => void;
  onSetEnergy: (item: QueueGroupDto["items"][number], energy: "deep" | "quick" | null) => void;
  onPreview: (item: QueueGroupDto["items"][number], group: QueueGroupDto) => void;
}) {
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
              checked={busyKey === sourceKey(item)}
              disabled={busyKey !== null}
              onChange={() => onComplete(item)}
            />
            <span className="kok-list__title">
              <button
                type="button"
                className="kok-list__open"
                onClick={() => onPreview(item, group)}
              >
                {item.title}
              </button>
              {item.projectName && item.priority ? (
                <small className="kok-list__sub">
                  {item.projectName} · {item.priority}
                </small>
              ) : null}
            </span>
            <EnergySwitch
              title={item.title}
              energy={item.energy}
              disabled={busyKey !== null}
              onChange={(energy) => onSetEnergy(item, energy)}
            />
            {item.kind === "overdue" && item.due ? (
              <span className="kok-badge kok-badge--danger">{item.due}</span>
            ) : null}
            {item.kind === "upcoming" && item.due ? (
              <span className="kok-badge">do {item.due}</span>
            ) : null}
            {item.kind === "undated" ? <span className="kok-badge">bez terminu</span> : null}
            {item.kind === "today" ? (
              <span className="kok-badge kok-badge--accent">dziś</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EventRow({
  event,
  current,
  nowMinutes,
}: {
  event: DayEventDto;
  current: boolean;
  nowMinutes: number;
}) {
  // brief tylko przy wydarzeniach, które się jeszcze nie skończyły (zakończone zostają zwarte)
  const brief =
    event.startMinutes + event.durationMinutes > nowMinutes ? briefLines(event.brief) : [];
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
        {brief.length > 0 ? (
          <div className="kok-brief" role="group" aria-label="Brief">
            <div className="kok-brief__label">Brief</div>
            <ul>
              {brief.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
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

function WindowSlot({ window: w }: { window: DeepWindowDto }) {
  return (
    <li className="kok-tl__item" data-testid="window-slot">
      <span />
      <span />
      <div className="kok-tl__slot">
        Okno{" "}
        <b>
          {hhmm(w.startMinutes)}–{hhmm(w.endMinutes)}
        </b>{" "}
        · proponowane: <span className={`kok-energy kok-energy--${w.energy}`}>{w.energy}</span>{" "}
        {w.projectName ? `${w.title} · ${w.projectName}` : w.title}
      </div>
    </li>
  );
}

function Timeline({
  events,
  windows,
  now,
}: {
  events: DayEventDto[];
  windows: DeepWindowDto[];
  now: Date;
}) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  type Entry =
    | { start: number; key: string; event: DayEventDto }
    | { start: number; key: string; window: DeepWindowDto };
  const entries: Entry[] = [
    ...events.map((event): Entry => ({ start: event.startMinutes, key: event.id, event })),
    ...upcomingWindows(windows, nowMinutes).map(
      (window): Entry => ({ start: window.startMinutes, key: `w${window.startMinutes}`, window })
    ),
  ].sort((a, b) => a.start - b.start);
  const items: React.ReactNode[] = [];
  let markerPlaced = false;
  for (const entry of entries) {
    if (!markerPlaced && entry.start > nowMinutes) {
      items.push(<NowMarker key="now" nowMinutes={nowMinutes} />);
      markerPlaced = true;
    }
    if ("window" in entry) {
      items.push(<WindowSlot key={entry.key} window={entry.window} />);
      continue;
    }
    const { event } = entry;
    const current =
      event.startMinutes <= nowMinutes && nowMinutes < event.startMinutes + event.durationMinutes;
    items.push(<EventRow key={event.id} event={event} current={current} nowMinutes={nowMinutes} />);
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
  onQueueChanged,
  onOpenTasks,
  focusInbox,
  onInboxFocused,
}: {
  data: CockpitDto;
  now: Date;
  apiFetch: ApiFetch;
  onChangeActive: () => void;
  onOpenProject: (id: string) => void;
  onInboxChanged: () => void;
  onQueueChanged: () => void;
  onOpenTasks: () => void;
  focusInbox?: boolean;
  onInboxFocused?: () => void;
}) {
  const [energyFilter, setEnergyFilter] = useState<EnergyFilter>("all");
  const allItems = data.queue.flatMap((g) => g.items);
  const totalQueueTasks = allItems.length;
  const deepCount = allItems.filter((i) => i.energy === "deep").length;
  const quickCount = allItems.filter((i) => i.energy === "quick").length;
  const hasEnergy = deepCount + quickCount > 0;
  // Pilne (zadania ogólne z priorytetem 1) idą na samą górę Kokpitu i nie powtarzają się w kolejce.
  const urgentEntries = data.queue.flatMap((g) =>
    g.items.filter((i) => i.urgent).map((item) => ({ item, group: g }))
  );
  const restQueue = data.queue
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.urgent) }))
    .filter((g) => g.items.length > 0);
  const visibleQueue = restQueue
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => energyFilter === "all" || i.energy === energyFilter),
    }))
    .filter((g) => g.items.length > 0);
  const visibleCount = visibleQueue.reduce((acc, g) => acc + g.items.length, 0);
  const [showAll, setShowAll] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    item: QueueGroupDto["items"][number];
    group: QueueGroupDto;
  } | null>(null);

  async function completeItem(item: QueueGroupDto["items"][number]) {
    setBusyKey(sourceKey(item));
    setQueueError(null);
    try {
      const res = await apiFetch("/api/cockpit/queue/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.source),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setPreview(null);
      onQueueChanged();
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : "Nie udało się domknąć zadania");
    } finally {
      setBusyKey(null);
    }
  }
  async function setItemEnergy(
    item: QueueGroupDto["items"][number],
    energy: "deep" | "quick" | null
  ) {
    setBusyKey(sourceKey(item));
    setQueueError(null);
    try {
      const res = await apiFetch("/api/cockpit/queue/energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item.source, energy }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const result = (await res.json().catch(() => ({}))) as { source?: typeof item.source };
      // podgląd zostaje otwarty i pokazuje nowy stan; źródło mogło dostać nowy tekst (zadanie projektu)
      setPreview((p) =>
        p && sourceKey(p.item) === sourceKey(item)
          ? { ...p, item: { ...p.item, energy, source: result.source ?? p.item.source } }
          : p
      );
      onQueueChanged();
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : "Nie udało się zmienić energii");
    } finally {
      setBusyKey(null);
    }
  }
  // Gdy zadań jest więcej niż QUEUE_LIMIT, widać pierwsze w kolejności kolejki (najbliższe daty).
  const limited = !showAll && visibleCount > QUEUE_LIMIT;
  let budget = limited ? QUEUE_LIMIT : Number.POSITIVE_INFINITY;
  const shownQueue = visibleQueue
    .map((g) => {
      const items = g.items.slice(0, Math.max(0, budget));
      budget -= items.length;
      return { ...g, items };
    })
    .filter((g) => g.items.length > 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const next = data.nextMeeting;
  const free = 3 - data.topics.length;

  return (
    <>
      {urgentEntries.length > 0 ? (
        <section className="kok-urgent" aria-label="Pilne">
          <h3 className="kok-urgent__title">
            <b>Pilne</b> · do zrobienia od ręki
          </h3>
          <ul className="kok-list">
            {urgentEntries.map(({ item, group }) => (
              <li key={sourceKey(item)} className="kok-list__item">
                <input
                  className="kok-check"
                  type="checkbox"
                  aria-label="zrobione"
                  checked={busyKey === sourceKey(item)}
                  disabled={busyKey !== null}
                  onChange={() => void completeItem(item)}
                />
                <span className="kok-list__title">
                  <button
                    type="button"
                    className="kok-list__open"
                    onClick={() => {
                      setQueueError(null);
                      setPreview({ item, group });
                    }}
                  >
                    {item.title}
                  </button>
                </span>
                <EnergySwitch
                  title={item.title}
                  energy={item.energy}
                  disabled={busyKey !== null}
                  onChange={(energy) => void setItemEnergy(item, energy)}
                />
                {item.kind === "overdue" && item.due ? (
                  <span className="kok-badge kok-badge--danger">{item.due}</span>
                ) : null}
                {item.kind === "today" ? (
                  <span className="kok-badge kok-badge--accent">dziś</span>
                ) : null}
                {item.kind === "upcoming" && item.due ? (
                  <span className="kok-badge">do {item.due}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="kok-tiles tiles" aria-label="Liczby dnia">
        <div className="kok-tile kok-tile--accent tile tile--accent">
          <span className="kok-tile__label">Następne spotkanie</span>
          <span className="kok-tile__value">{next ? hhmm(next.startMinutes) : "—"}</span>
          <span className="kok-tile__meta">
            {next
              ? next.date !== data.date
                ? `${meetingDayLabel(next.date, data.date)} · ${next.title}`
                : next.startMinutes <= nowMinutes
                  ? `trwa · ${next.title}`
                  : `za ${minutesUntil(nowMinutes, next.startMinutes)} min · ${next.title}`
              : "brak nadchodzących spotkań"}
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
              <span className="kok-chip">00–24</span>
            </div>
            {data.events.length === 0 ? (
              <p className="kok-empty-msg">Brak wydarzeń na dziś</p>
            ) : (
              <Timeline events={data.events} windows={data.windows} now={now} />
            )}
          </section>

          <CommitHistory apiFetch={apiFetch} day={data.date} />
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
            {restQueue.length === 0 ? (
              <p className="kok-empty-msg">Nic w kolejce</p>
            ) : visibleCount === 0 ? (
              <p className="kok-empty-msg">Brak zadań z tą energią</p>
            ) : (
              <div className="kok-queue">
                {shownQueue.map((group) => (
                  <QueueGroupCard
                    key={group.projectId ?? "general"}
                    group={group}
                    busyKey={busyKey}
                    onComplete={(item) => void completeItem(item)}
                    onSetEnergy={(item, energy) => void setItemEnergy(item, energy)}
                    onPreview={(item, g) => {
                      setQueueError(null);
                      setPreview({ item, group: g });
                    }}
                  />
                ))}
              </div>
            )}
            {queueError && !preview ? (
              <p className="kok-state kok-state--error" role="alert">
                {queueError}
              </p>
            ) : null}
            {visibleCount > QUEUE_LIMIT ? (
              <button
                type="button"
                className="kok-btn kok-btn--sm kok-btn--ghost"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Pokaż mniej" : `Pokaż wszystkie (${visibleCount})`}
              </button>
            ) : null}
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

      {preview ? (
        <QueueItemDialog
          item={preview.item}
          groupName={preview.group.name}
          projectId={preview.group.projectId}
          busy={busyKey !== null}
          error={queueError}
          onComplete={() => void completeItem(preview.item)}
          onSetEnergy={(energy) => void setItemEnergy(preview.item, energy)}
          onOpenProject={(id) => {
            setPreview(null);
            onOpenProject(id);
          }}
          onOpenTasks={() => {
            setPreview(null);
            onOpenTasks();
          }}
          onClose={() => {
            setPreview(null);
            setQueueError(null);
          }}
        />
      ) : null}

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
