import * as firestoreDb from "@/lib/firestore-db";
import * as tagService from "@/services/tagService";
import { generateContent } from "@/lib/gemini";
import { formatYmd, weekRangeMonSun } from "@/lib/dateRef";

const RAG_PLAN_MODEL = "gemini-2.5-flash";

const PLAN_EVENT_DAY_RADIUS = 60;

const SYSTEM_INSTRUCTION_PL = `Jesteś asystentem planowania. Masz listę wpisów kalendarza użytkownika (data, godzina, czas w min, tytuł, tagi).
W każdej wiadomości podana jest lista istniejących tagów użytkownika. Gdy użytkownik podaje tag (np. #vibe coding, #Vibe Coding), użyj DOKŁADNIE nazwy z tej listy (dopasowanie bez względu na wielkość liter). Jeśli użytkownik poda tag, którego nie ma na liście (np. zupełnie nowy temat), wpisz go w JSON tak jak podał; system zapyta wtedy, czy dodać nowy tag.

Nie licz czasu pracy ani nie podawaj sum godzin na tagi / miesiące — do tego służy zakładka „Moja praca” (ustawiany zakres dat). Jeśli użytkownik pyta o ile godzin, statystyki czasu lub podsumowanie pracy, odpowiedz jednym krótkim zdaniem po polsku, że sumy po tagach i okresie znajdzie w Moja praca; nie wykonuj obliczeń z listy wpisów.

Gdy użytkownik mówi że ma coś do zrobienia lub chce dodać wpis (np. "mam do zrobienia w tym tygodniu testy modułu auth", "Dodaj 27.02 #Vibe coding od 21:45 do 23:30") - zwróć TYLKO poprawny JSON bez markdown, w formacie:
{"action":"add_events","events":[{"title":"...","tags":["tag1"],"dates":["YYYY-MM-DD"],"duration_minutes":60,"start_minutes":540}]}
- start_minutes: 540 = 9:00, 21:45 = 21*60+45 = 1312. dates: jeden dzień = jeden blok; jeśli "3 dni" podaj 3 daty (np. następne 3 dni robocze). "w tym tygodniu" = jeden dzień (np. piątek). Dla tagów użyj dokładnie nazwy z listy istniejących tagów (wielkość liter jak na liście).`;

const SYSTEM_INSTRUCTION_EN = `You are a planning assistant. You have the user's calendar events (date, time, duration_minutes, title, tags).
Each message includes the user's existing tags list. When the user refers to a tag (e.g. #vibe coding, #Vibe Coding), use the EXACT tag name from that list (case-insensitive match). If the user mentions a tag that is not on the list (e.g. a new topic), include it as-is in the JSON; the system will then ask whether to add the new tag.

Do not compute or report hours worked, time summaries, or statistics from the event list — use the "My Work" tab for date-range totals by tag. If the user asks how many hours, time stats, or work summaries, reply in one short sentence that they can see totals in My Work; do not calculate from the list.

If the user wants to add something to the calendar or describes a task (e.g. "I have to do auth module tests this week", "Add 27.02 #Vibe coding from 21:45 to 23:30") - return ONLY valid JSON, no markdown:
{"action":"add_events","events":[{"title":"...","tags":["tag1"],"dates":["YYYY-MM-DD"],"duration_minutes":60,"start_minutes":540}]}
- start_minutes: 540 = 9:00, 21:45 = 21*60+45 = 1312. dates: one date = one block; if "3 days" give 3 dates. "this week" = one day (e.g. Friday). For tags use the exact name from the existing tags list (same capitalization).`;

export async function ask(
  userId: string,
  params: {
    message: string;
    lang?: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  }
): Promise<{ text: string; created?: number; unknownTags?: string[] }> {
  const { message, lang = "en", history = [] } = params;
  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - PLAN_EVENT_DAY_RADIUS);
  const future = new Date(now);
  future.setDate(future.getDate() + PLAN_EVENT_DAY_RADIUS);
  const startDate = past.toISOString().slice(0, 10);
  const endDate = future.toISOString().slice(0, 10);

  const [events, userTags] = await Promise.all([
    firestoreDb.getCalendarEvents(userId, { startDate, endDate }),
    tagService.getUserTags(userId),
  ]);

  const eventsContext = events
    .map(
      (e) =>
        `- ${e.date} ${Math.floor(e.start_minutes / 60)}:${String(e.start_minutes % 60).padStart(2, "0")} ${e.duration_minutes}min "${e.title}" tags:${(e.tags || []).join(",")}`
    )
    .join("\n");

  const todayStr = formatYmd(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthStartStr = formatYmd(monthStart);
  const monthEndStr = formatYmd(monthEnd);
  const week = weekRangeMonSun(now);

  const existingTagList = userTags.map((t) => t.tag).filter(Boolean);
  const tagsContext =
    existingTagList.length > 0
      ? `\nUser's existing tags (use exact spelling from this list): ${existingTagList.join(", ")}`
      : "";

  const historyContext = history
    .slice(-18)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const dateRef =
    lang === "pl"
      ? `Daty referencyjne: dzisiaj=${todayStr}. Bieżący miesiąc kalendarzowy: ${monthStartStr} … ${monthEndStr}. Bieżący tydzień (pon–niedz): ${week.start} … ${week.end}.`
      : `Reference dates: today=${todayStr}. Current calendar month: ${monthStartStr} through ${monthEndStr}. Current week (Mon–Sun): ${week.start} through ${week.end}.`;

  const contents =
    `${dateRef}\n\nUser calendar events:\n${eventsContext || "(no events in range)"}${tagsContext}` +
    (historyContext ? `\n\nConversation history:\n${historyContext}\n\n` : "\n\n") +
    `User message: ${message}`;

  const systemInstruction = lang === "pl" ? SYSTEM_INSTRUCTION_PL : SYSTEM_INSTRUCTION_EN;
  const text = await generateContent({
    model: RAG_PLAN_MODEL,
    contents,
    systemInstruction,
  });

  const jsonMatch = text.match(/\{[\s\S]*"action"\s*:\s*"add_events"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[0]) as {
        action?: string;
        events?: Array<{
          title?: string;
          tags?: string[];
          dates?: string[];
          date?: string;
          duration_minutes?: number;
          start_minutes?: number;
          color?: string;
        }>;
      };
      if (data.action === "add_events" && Array.isArray(data.events)) {
        const unknownTagsSet = new Set<string>();
        const resolveTag = (t: string): string => {
          const trimmed = (t ?? "").trim().replace(/^#/, "");
          if (!trimmed) return trimmed;
          const found = userTags.find((u) => u.tag.toLowerCase() === trimmed.toLowerCase());
          if (found) return found.tag;
          unknownTagsSet.add(trimmed);
          return trimmed;
        };

        for (const ev of data.events) {
          const tags = Array.isArray(ev.tags) ? ev.tags : [];
          for (const t of tags) resolveTag(t);
        }

        if (unknownTagsSet.size > 0) {
          const unknownList = Array.from(unknownTagsSet);
          const replyAsk =
            lang === "pl"
              ? `Tag "${unknownList.join('", "')}" nie istnieje. Czy dodać nowy tag i dodać wpis do kalendarza?`
              : `Tag "${unknownList.join('", "')}" does not exist. Add this tag and create the calendar entry?`;
          return { text: replyAsk, unknownTags: unknownList };
        }

        const defaultColors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"];
        const getColorForTags = (tagNames: string[]): string | undefined => {
          for (const name of tagNames) {
            const ut = userTags.find((u) => u.tag === name);
            if (ut?.color) return ut.color;
          }
          return undefined;
        };
        let created = 0;
        for (const ev of data.events) {
          const dates = ev.dates ?? (ev.date ? [ev.date] : []);
          const title = ev.title ?? "Task";
          const rawTags = Array.isArray(ev.tags) ? ev.tags : [];
          const tags = rawTags.map((t) => resolveTag(t)).filter(Boolean);
          const d = Number(ev.duration_minutes) ?? 60;
          const duration = Math.max(15, Math.round(d / 15) * 15);
          const startMin = Number(ev.start_minutes) ?? 540;
          const color =
            getColorForTags(tags) ?? ev.color ?? defaultColors[created % defaultColors.length];
          for (const date of dates) {
            await firestoreDb.createCalendarEvent(userId, {
              date: String(date).slice(0, 10),
              start_minutes: startMin,
              duration_minutes: duration,
              title,
              tags,
              color,
            });
            created++;
          }
        }
        const replyText =
          lang === "pl"
            ? `Dodano ${created} wpis(ów) do kalendarza.`
            : `Added ${created} event(s) to calendar.`;
        return { text: replyText, created };
      }
    } catch {
      // fall through to return raw text
    }
  }

  return { text };
}
