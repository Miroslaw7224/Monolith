// src/features/home/CockpitSections.tsx
import React from "react";
import type {
  CockpitDto,
  DayEventDto,
  QueueGroupDto,
  TopicDto,
} from "@/contexts/bc_cockpit/schemas";

const CARD = "bg-[var(--surface)] border border-[var(--border)] rounded-xl";
const SECTION_TITLE = "text-xs font-bold uppercase tracking-widest text-[var(--text2)]";
const BADGE =
  "ml-2 px-2 py-px text-[11px] font-normal rounded border border-[var(--danger,#ff7272)] text-[var(--text)]";

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

function Line({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="text-sm text-[var(--text2)] mt-1">
      <span className="text-[var(--text3)]">{label}: </span>
      {value}
    </p>
  );
}

function TopicCard({ topic }: { topic: TopicDto }) {
  return (
    <article className={`${CARD} p-4`} aria-label={`Temat ${topic.name}`}>
      <h4 className="text-sm font-bold text-[var(--text)]">
        {topic.name}
        {topic.owner === "work" ? <span className={BADGE}>Dane z firmy</span> : null}
        {topic.freshness === "stale" ? <span className={BADGE}>do sprawdzenia</span> : null}
      </h4>
      {topic.source === "state" ? (
        <>
          <Line label="Następny krok" value={topic.nextStep} />
          <Line label="Blokada" value={topic.blocker} />
        </>
      ) : topic.source === "index" ? (
        <Line label="Gdzie skończyłem" value={topic.whereIStopped} />
      ) : (
        <p className="text-sm text-[var(--text3)] mt-1">Brak zapisanego stanu</p>
      )}
    </article>
  );
}

function QueueGroupCard({ group }: { group: QueueGroupDto }) {
  return (
    <section className={`${CARD} p-3`} aria-label={`Kolejka: ${group.name}`}>
      <h4 className="text-sm font-bold text-[var(--text)] mb-2">
        {group.name}
        {group.owner === "work" ? <span className={BADGE}>Dane z firmy</span> : null}
      </h4>
      <ul className="space-y-1">
        {group.items.map((item, i) => (
          <li key={`${item.kind}-${i}`} className="flex items-center gap-3 text-sm">
            <div className="w-3 h-3 rounded border-2 border-[var(--accent)] flex-shrink-0" />
            <span className="text-[var(--text)] flex-1">{item.title}</span>
            {item.kind === "overdue" && item.due ? (
              <span className="text-xs text-[var(--danger,#ff7272)]">{item.due}</span>
            ) : null}
            {item.kind === "today" ? (
              <span className="text-xs text-[var(--accent)]">dziś</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EventRow({ event }: { event: DayEventDto }) {
  return (
    <li className={`${CARD} flex items-center gap-3 p-3`}>
      <span className="text-xs text-[var(--text2)] tabular-nums">{hhmm(event.startMinutes)}</span>
      <span className="text-sm text-[var(--text)] flex-1">{event.title}</span>
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
  return (
    <>
      <section aria-label="Aktywne tematy">
        <div className="flex items-center justify-between mb-3">
          <h3 className={SECTION_TITLE}>Aktywne tematy</h3>
          <button
            type="button"
            onClick={onChangeActive}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Zmień aktywne
          </button>
        </div>
        {data.topics.length === 0 ? (
          <p className="text-sm text-[var(--text3)]">Przypnij projekty</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {data.topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Kolejka na dziś">
        <h3 className={`${SECTION_TITLE} mb-3`}>Kolejka na dziś</h3>
        {data.queue.length === 0 ? (
          <p className="text-sm text-[var(--text3)]">Nic w kolejce</p>
        ) : (
          <div className="space-y-3">
            {data.queue.map((group) => (
              <QueueGroupCard key={group.projectId ?? "general"} group={group} />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Oś dnia">
        <h3 className={`${SECTION_TITLE} mb-3`}>Oś dnia</h3>
        {data.events.length === 0 ? (
          <p className="text-sm text-[var(--text3)]">Brak wydarzeń na dziś</p>
        ) : (
          <ul className="space-y-2">
            {data.events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </section>

      {data.warnings.length > 0 ? (
        <ul className="text-xs text-[var(--text3)] space-y-1" aria-label="Ostrzeżenia">
          {data.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
