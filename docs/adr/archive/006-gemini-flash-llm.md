# ADR-006: Gemini 1.5 Flash jako model LLM

## Status

Zaakceptowany

## Kontekst

RAG wymaga modelu LLM do generowania odpowiedzi na podstawie dostarczonych chunków. W aplikacji chat każde pytanie generuje koszt — priorytetem jest niski koszt per token oraz szybkość odpowiedzi. Streaming (token po tokenie) poprawia UX — użytkownik nie czeka na całą odpowiedź.

Okno kontekstowe musi pomieścić wiele chunków (potencjalnie setki) plus historię rozmowy. Model musi integrować się z Next.js Streaming API.

## Decyzja

Wybieramy **Gemini 1.5 Flash** jako model do Q&A. Najszybszy model w ekosystemie Google przy najniższym koszcie per token. Okno kontekstowe 1M tokenów eliminuje problem „zbyt dużo dokumentów do wklejenia". Streaming response natywny — prosta integracja z Next.js Streaming API.

Spójność z Gemini text-embedding-004 — jeden dostawca API (Google).

## Rozważane alternatywy

- **GPT-4o-mini** — konkurencyjny koszt i jakość; dodatkowy dostawca API
- **Claude Haiku** — podobna filozofia; dodatkowy serwis
- **Mistral 7B (self-hosted)** — zerowy koszt per token; wymaga infrastruktury, niższa jakość

## Konsekwencje

**Pozytywne:**

- Niski koszt per token — krytyczne dla chat aplikacji
- Okno 1M tokenów — brak obcięcia kontekstu
- Streaming natywny — UX token po tokenie
- Jeden dostawca z embeddingami — prostszy stack

**Negatywne:**

- Flash mniej precyzyjny niż Gemini Pro/Ultra przy skomplikowanym wnioskowaniu — dla prostego Q&A różnica nieistotna
- Latencja pierwszego tokenu bywa wyższa niż GPT-4o-mini — monitorować po launchu

## Stan aplikacji (luty 2026)

Gemini używany w Next.js przez `lib/gemini.ts` (ragService, planService). Modele w kodzie: np. gemini-3-flash-preview (RAG), gemini-2.0-flash (plan). Odpowiedzi zwracane w całości (brak Next.js Streaming API).
