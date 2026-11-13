// src/features/home/CockpitSections.tsx
import React from "react";
import type {
  CockpitDto,
  DayEventDto,
  QueueGroupDto,
  TopicDto,
} from "@/contexts/bc_cockpit/schemas";

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

function Line({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <>
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </>
  );
}

function TopicCard({ topic }: { topic: TopicDto }) {
  return (
    <article className="kok-topic kok-panel" aria-label={`Temat ${topic.name}`}>
      <div className="kok-topic__head">
        <h4 className="kok-topic__name">{topic.name}</h4>
        <div className="kok-topic__badges">
          {topic.owner === "work" ? (
            <span className="kok-badge kok-badge--warn">Dane z firmy</span>
          ) : null}
          {topic.freshness === "stale" ? (
            <span className="kok-badge kok-badge--danger">do sprawdzenia</span>
          ) : null}
        </div>
      </div>
      {topic.source === "state" ? (
        <>
          {topic.nextStep ? (
            <p className="kok-topic__next">
              <span>{topic.nextStep}</span>
            </p>
          ) : null}
          <dl className="kok-kv">
            <Line label="Blokada" value={topic.blocker} />
          </dl>
        </>
      ) : topic.source === "index" ? (
        <dl className="kok-kv">
          <Line label="Gdzie skończyłem" value={topic.whereIStopped} />
        </dl>
      ) : (
        <p className="kok-topic__empty">Brak zapisanego stanu</p>
      )}
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
            <input className="kok-check" type="checkbox" aria-label="zrobione" readOnly />
            <span className="kok-list__title">{item.title}</span>
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

function EventRow({ event }: { event: DayEventDto }) {
  return (
    <li className="kok-tl__item">
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

export function CockpitSections({
  data,
  onChangeActive,
}: {
  data: CockpitDto;
  onChangeActive: () => void;
}) {
  const totalQueueTasks = data.queue.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <>
      <section className="kok-tiles tiles" aria-label="Liczby dnia">
        <div className="kok-tile kok-tile--accent tile tile--accent">
          <span className="kok-tile__label">Aktywne tematy</span>
          <span className="kok-tile__value">
            {data.topics.length}
            <span className="kok-tile__sub"> / 3</span>
          </span>
          <span className="kok-tile__meta">limit 3 tematy</span>
        </div>
        <div className="kok-tile tile">
          <span className="kok-tile__label">Kolejka zadań</span>
          <span className="kok-tile__value">{totalQueueTasks}</span>
          <span className="kok-tile__meta">{data.queue.length} grup projektowych</span>
        </div>
        <div className="kok-tile tile">
          <span className="kok-tile__label">Wydarzenia dnia</span>
          <span className="kok-tile__value">{data.events.length}</span>
          <span className="kok-tile__meta">
            {data.events.length === 0 ? "wolny kalendarz" : "zaplanowane w kalendarzu"}
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
              <b>Oś dnia</b> · kalendarz
            </h3>
            <span className="kok-chip">{data.events.length} dziś</span>
          </div>
          {data.events.length === 0 ? (
            <p className="kok-empty-msg">Brak wydarzeń na dziś</p>
          ) : (
            <ol className="kok-tl">
              {data.events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </ol>
          )}
        </section>

        <section className="kok-focus" aria-label="Aktywne tematy">
          <div className="kok-panel__head">
            <h3 className="kok-panel__title">
              <b>Punkty skupienia</b> · Save State
            </h3>
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
            <>
              {data.topics.map((topic) => (
                <TopicCard key={topic.id} topic={topic} />
              ))}
              {data.topics.length < 3 ? (
                <button className="kok-empty" type="button" onClick={onChangeActive}>
                  <span>Wolne miejsce na kolejny temat</span>
                  <span className="kok-kbd">+</span>
                </button>
              ) : null}
            </>
          )}
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
