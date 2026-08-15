import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Play, Square } from "lucide-react";
import { formatDuration, CALENDAR_COLORS } from "./calendarConstants";
import type { UserTag } from "./TagsSection";
import { eventMinutesInInclusiveRange } from "@/lib/calendarRange";
import type { ActiveSession } from "@/src/lib/activeSession";

export interface CalendarEvent {
  id: string;
  date: string;
  start_minutes: number;
  duration_minutes: number;
  title: string;
  tags: string[];
  color: string;
  created_at?: string;
}

type TranslationDict = Record<string, string | string[]>;

interface ActivityLogProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  lang: "en" | "pl";
  t: TranslationDict;
  userTags?: UserTag[];
  activeSession?: ActiveSession | null;
  onStartSession?: () => void;
  onEndSession?: () => void;
}

export function ActivityLog({
  apiFetch,
  lang,
  t,
  userTags = [],
  activeSession,
  onStartSession,
  onEndSession,
}: ActivityLogProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/calendar/events?startDate=${startDate}&endDate=${endDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled)
          setEvents(
            Array.isArray(data)
              ? data
                  .filter((ev: CalendarEvent) => !ev.id.startsWith("task:"))
                  .sort(
                    (a: CalendarEvent, b: CalendarEvent) =>
                      a.date.localeCompare(b.date) || a.start_minutes - b.start_minutes
                  )
              : []
          );
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiFetch, startDate, endDate]);

  const tagHours = useMemo(() => {
    const byTag = new Map<string, number>();
    for (const ev of events) {
      const minutesInRange = eventMinutesInInclusiveRange(ev, startDate, endDate);
      if (minutesInRange <= 0) continue;
      for (const tag of ev.tags) {
        if (!tag.trim()) continue;
        const prev = byTag.get(tag) ?? 0;
        byTag.set(tag, prev + minutesInRange);
      }
    }
    const arr = Array.from(byTag.entries()).map(([tag, minutes]) => ({
      tag,
      hours: Math.round((minutes / 60) * 10) / 10,
    }));
    arr.sort((a, b) => b.hours - a.hours);
    return arr;
  }, [events, startDate, endDate]);

  const tagToColor = useMemo(() => {
    const map = new Map<string, string>();
    let idx = 0;
    for (const u of userTags) {
      if (u.tag) map.set(u.tag, u.color || CALENDAR_COLORS[idx % CALENDAR_COLORS.length]);
      idx++;
    }
    return map;
  }, [userTags]);

  const maxHours = useMemo(() => {
    if (tagHours.length === 0) return 5;
    const max = Math.max(...tagHours.map((d) => d.hours));
    return Math.ceil(max / 2.5) * 2.5;
  }, [tagHours]);

  const xAxisTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let v = 0; v <= maxHours; v += 1.25) ticks.push(v);
    return ticks;
  }, [maxHours]);

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const labels = {
    title: (t.activityTitle as string) ?? "What I did",
    from: (t.activityFrom as string) ?? "From",
    to: (t.activityTo as string) ?? "To",
    noEntries: (t.activityNoEntries as string) ?? "No entries in the selected period.",
    noTags: (t.activityNoTags as string) ?? "No tags in the selected period.",
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg)]">
      <div className="p-6 border-b border-[var(--border)] bg-[var(--surface)]">
        <h2 className="text-lg font-bold mb-4 text-[var(--text)]">{labels.title}</h2>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
            <span>{labels.from}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 bg-[var(--bg3)] border-none rounded-lg text-sm text-[var(--text)]"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
            <span>{labels.to}</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 bg-[var(--bg3)] border-none rounded-lg text-sm text-[var(--text)]"
            />
          </label>
          {onStartSession &&
            (activeSession ? (
              <button
                onClick={onEndSession}
                className="flex items-center gap-2 px-3 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:brightness-110"
              >
                <Square className="w-3 h-3" />
                <span>
                  {lang === "pl" ? "Zakończ" : "End"} ·{" "}
                  {new Date(activeSession.startedAt).toLocaleTimeString(
                    lang === "pl" ? "pl-PL" : "en-US",
                    { hour: "2-digit", minute: "2-digit" }
                  )}
                </span>
              </button>
            ) : (
              <button
                onClick={onStartSession}
                className="flex items-center gap-2 px-3 py-2 bg-[var(--bg3)] border border-[var(--border)] rounded-lg text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg2)]"
              >
                <Play className="w-3 h-3 text-[var(--accent)]" />
                {lang === "pl" ? "Rozpocznij pracę" : "Start work"}
              </button>
            ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6 flex gap-6 min-h-0">
        {loading ? (
          <div className="text-[var(--text2)]">Loading…</div>
        ) : events.length === 0 ? (
          <p className="text-[var(--text3)] font-medium">{labels.noEntries}</p>
        ) : (
          <>
            <ul className="flex-[2_2_0%] min-w-0 space-y-1.5 overflow-auto pr-2">
              {events.map((ev) => {
                const minutesInRange = eventMinutesInInclusiveRange(ev, startDate, endDate);
                const partial = minutesInRange > 0 && minutesInRange !== ev.duration_minutes;
                const durationPart = partial
                  ? `${formatDuration(minutesInRange)}${
                      lang === "pl" ? " w zakresie" : " in range"
                    } · ${formatDuration(ev.duration_minutes)} ${
                      lang === "pl" ? "łącznie" : "total"
                    }`
                  : formatDuration(minutesInRange);
                return (
                  <li
                    key={ev.id}
                    className="flex items-center gap-3 py-2 px-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl"
                  >
                    <div
                      className="w-2 h-5 rounded flex-shrink-0"
                      style={{ backgroundColor: ev.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-tight text-[var(--text)]">
                        {ev.title}
                      </p>
                      <p className="text-[10px] text-[var(--text3)] uppercase font-bold mt-0.5 leading-tight">
                        {ev.date} · {formatTime(ev.start_minutes)} · {durationPart}
                        {ev.tags.length > 0 && ` · ${ev.tags.map((tag) => `#${tag}`).join(" ")}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex-[3_3_0%] min-w-0 flex flex-col self-start bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 activity-chart">
              {tagHours.length === 0 ? (
                <p className="text-[var(--text3)] font-medium text-sm">{labels.noTags}</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(140, tagHours.length * 28)}>
                    <BarChart
                      data={tagHours}
                      layout="vertical"
                      margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        type="number"
                        domain={[0, maxHours]}
                        ticks={xAxisTicks}
                        className="text-[var(--text2)]"
                        tick={{ fill: "var(--text2)" }}
                        axisLine={{ stroke: "var(--border)" }}
                        fontSize={12}
                      />
                      <YAxis
                        type="category"
                        dataKey="tag"
                        tickFormatter={(v) => `#${v}`}
                        width={100}
                        tick={{ fill: "var(--text2)" }}
                        axisLine={{ stroke: "var(--border)" }}
                        fontSize={12}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value} h`, "Godziny"]}
                        labelFormatter={(label) => `#${label}`}
                      />
                      <Bar dataKey="hours" radius={[0, 4, 4, 0]} barSize={24}>
                        {tagHours.map((entry) => (
                          <Cell key={entry.tag} fill={tagToColor.get(entry.tag) ?? "#3B82F6"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 pt-4 border-t border-[var(--border)] flex flex-wrap gap-x-6 gap-y-2">
                    {tagHours.map(({ tag, hours }) => (
                      <div key={tag} className="flex items-center gap-2 text-sm">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tagToColor.get(tag) ?? "#3B82F6" }}
                        />
                        <span className="font-medium text-[var(--text)]">#{tag}</span>
                        <span className="text-[var(--text2)]">{hours} h</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
