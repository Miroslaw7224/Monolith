# ⚙️ Tech Stack

**Second Brain dla Freelancerów**
_Uzasadnienie decyzji technologicznych | MVP v1.1_

---

| Zasada #1                                           | Zasada #2                                               |
| --------------------------------------------------- | ------------------------------------------------------- |
| _Minimalny stack, maksymalna szybkość dostarczenia_ | _Zero lock-in na wczesnym etapie (świadome kompromisy)_ |

---

## Architektura — big picture

> _Next.js (frontend + API) → Firebase (auth, storage, DB, functions) → Gemini API (embeddingi + chat) → Vercel (hosting) → Stripe (płatności)_

Cały stack jest serverless, nie wymaga zarządzania infrastrukturą i mieści się w darmowych tierach na etapie MVP. Jeden dostawca backendu (Firebase), jeden dostawca AI (Google/Gemini), jeden hosting (Vercel) — minimalna liczba zewnętrznych zależności.

---

## 1. Frontend — Next.js 14 (App Router)

> **Wybrano:** Next.js 14 z App Router
> **Alternatywy:** _Vite + React SPA, Remix, SvelteKit_

### Dlaczego Next.js

Next.js pozwala pisać frontend i backend API w jednym projekcie, co na etapie solo developera eliminuje context switching między repozytoriami. App Router upraszcza routing, a server components redukują ilość JS wysyłanego do klienta — istotne dla czasu ładowania chat UI.

Krytyczny argument: RAG pipeline (chunking, embeddingi, similarity search) może żyć jako Route Handler (`/api/chat`, `/api/upload`) w tym samym projekcie — bez oddzielnego serwera backendowego.

### Kompromisy

- App Router ma stromą krzywą uczenia jeśli znasz tylko Pages Router
- SSR może komplikować real-time UI czatu — rozwiąże to Streaming Response z Gemini API

---

## 2. Autentykacja — Firebase Auth

> **Wybrano:** Firebase Auth
> **Alternatywy:** _NextAuth.js, Supabase Auth, Clerk_

### Dlaczego Firebase Auth

Czas wdrożenia: poniżej 1 godziny od zera do działającego logowania przez email + Google OAuth. Nie wymaga własnej bazy users — Firebase zarządza sesjami, tokenami i bezpieczeństwem. Krytyczne na MVP gdzie każdy dzień ma znaczenie.

Bezpośrednia integracja z Firestore (reguły bezpieczeństwa oparte na `request.auth.uid`) oznacza, że izolacja danych per user jest wbudowana w bazę — nie trzeba jej ręcznie implementować w API.

### Kompromisy

- Silny lock-in w ekosystem Google (celowy wybór na MVP)
- Migracja do własnego auth systemu w przyszłości wymagałaby pracy — akceptowalne

---

## 3. Baza danych — Firestore

> **Wybrano:** Firestore (NoSQL)
> **Alternatywy:** _PostgreSQL (Supabase), PlanetScale, MongoDB Atlas_

### Dlaczego Firestore

Firestore jest serverless — zero konfiguracji serwera, zero migracji schematu, automatyczne skalowanie. Na MVP z potencjalnie zmienną strukturą dokumentów (różne typy notatek, metadane) elastyczność NoSQL jest wartością.

Kluczowy argument dla RAG: wektory embeddingów będą przechowywane jako pola tablicowe w dokumentach Firestore. Cosine similarity można liczyć bezpośrednio w Next.js API Route — bez potrzeby dedykowanego vector store na MVP.

### Kompromisy

- Cosine similarity w kodzie aplikacji jest wolniejsze niż dedykowany vector store — akceptowalne do ~1000 chunków per user na MVP
- Przy skalowaniu (10k+ chunków per user) konieczna migracja do Pinecone lub pgvector — świadomy wybór

### Struktura kolekcji

```
users/{userId}/documents/{docId}       → metadane dokumentu
users/{userId}/notes/{noteId}          → notatki
users/{userId}/chunks/{chunkId}        → chunk + wektor embeddingu
users/{userId}/calendar_events/{id}   → wydarzenia kalendarza
users/{userId}/tasks/{id}              → zadania
users/{userId}/user_tags/{id}          → tagi
users/{userId}/resources/{id}        → zasoby (linki)
users/{userId}/mindMaps/{id}           → mapy myśli (drzewo węzłów w jednym dokumencie)
```

(Szczegóły map myśli: **ADR-017**.)

---

## 4. Przechowywanie plików — Firebase Storage

> **Wybrano:** Firebase Storage
> **Alternatywy:** _Supabase Storage, AWS S3, Cloudflare R2_

### Dlaczego Firebase Storage

Zero konfiguracji w kontekście istniejącego projektu Firebase. Upload bezpośrednio z Next.js z SDK Firebase Client — bez własnego presigned URL flow. Reguły bezpieczeństwa są zsynchronizowane z Firebase Auth (ten sam uid).

Na MVP limit 10MB per plik i 3 pliki jednocześnie jest wystarczający. Koszt Firebase Storage jest pomijalny przy tej skali.

### Kompromisy

- Droższe niż Cloudflare R2 przy dużej skali — nieistotne na MVP
- Brak edge CDN dla plików — nieistotne dla dokumentów tekstowych

---

## 5. Embeddingi (RAG) — Gemini text-embedding-004

> **Wybrano:** Gemini text-embedding-004
> **Alternatywy:** _OpenAI text-embedding-3-small, Cohere Embed, lokalne modele (all-MiniLM)_

### Dlaczego Gemini text-embedding-004

Spójność ekosystemu: jeden dostawca API (Google) dla embeddingów i chatu minimalizuje liczbę kluczy API, billing dashboardów i punktów awarii. Gemini text-embedding-004 produkuje wektory 768-wymiarowe — wystarczające dla Q&A na dokumentach prywatnych.

Koszt jest znacznie niższy niż OpenAI przy porównywalnej jakości dla angielskiego i polskiego tekstu. Limit $20/msc w Google Cloud Console działa jako hard cap na niespodziewane koszty.

### Kompromisy

- Nieznacznie niższa jakość embeddingów dla specjalistycznych domen niż OpenAI — nieistotne dla prywatnych notatek freelancerów
- Zależność od dostępności Google API — ryzyko łagodzone przez prostotę zamiany na innego dostawcę (interfejs embeddingów jest abstrahowalny)

---

## 6. Chat AI — Gemini 1.5 Flash

> **Wybrano:** Gemini 1.5 Flash
> **Alternatywy:** _GPT-4o-mini, Claude Haiku, Mistral 7B (self-hosted)_

### Dlaczego Gemini 1.5 Flash

Najszybszy model w ekosystemie Google przy najniższym koszcie per token — krytyczne dla aplikacji chat gdzie każde pytanie generuje koszt. Okno kontekstowe 1M tokenów eliminuje problem „zbyt dużo dokumentów do wklejenia w prompt".

Streaming response jest natywny i prosty w integracji z Next.js Streaming API — użytkownik widzi odpowiedź token po tokenie, nie czeka na całość.

### Kompromisy

- Flash jest mniej precyzyjny niż Gemini Pro/Ultra przy skomplikowanych zadaniach wnioskowania — dla prostego Q&A na dokumentach różnica jest nieistotna
- Latencja pierwszego tokenu bywa wyższa niż GPT-4o-mini — monitorować po launchu

---

## 7. Vector Search — Firestore + cosine similarity

> **Wybrano:** Custom cosine similarity w Next.js API Route
> **Alternatywy:** _Pinecone, Weaviate, pgvector (Supabase), Qdrant, Vertex AI Vector Search_

### Dlaczego własna implementacja na MVP

Dodatkowy serwis (Pinecone, Weaviate, Vertex AI) to dodatkowe konto, dodatkowy billing, dodatkowy punkt awarii i dodatkowy czas konfiguracji. Na MVP z limitem 50 dokumentów per user (co daje ~500–1000 chunków), cosine similarity w JavaScript jest wystarczająco szybkie (< 100ms).

Algorytm jest prosty: pobierz wszystkie wektory usera z Firestore → oblicz podobieństwo kosinusowe → zwróć top-k chunków.

### Kompromisy

- Wolniejsze niż dedykowany vector store przy dużej liczbie chunków — celowo odroczona decyzja
- Brak zaawansowanego filtrowania metadanych — wystarczające na MVP

> _Próg migracji: gdy użytkownik ma > 2000 chunków LUB latencja search > 500ms — czas na Pinecone lub pgvector._

---

## 8. Automatyzacje i logika serverside — Firebase Cloud Functions ✅ NOWE

> **Wybrano:** Firebase Cloud Functions
> **Alternatywy:** _Make (Integromat) — używany w Etapie 1 no-code, Zapier, własny serwer Express_

### Kontekst

W Etapie 1 (no-code, walidacja) automatyzacje obsługuje **Make (Integromat)** — łączy Tally z Firestore, wysyła emaile powitalne, zarządza triggerami onboardingu. To rozwiązanie wystarczające na 5–7 dni walidacji.

Przy przejściu do Etapu 2 (Next.js) Make zostaje zastąpiony przez **Firebase Cloud Functions** — serverless funkcje w tym samym ekosystemie Firebase, bez oddzielnego konta i billingu.

### Dlaczego Firebase Cloud Functions

Spójność ekosystemu: Cloud Functions mają natywny dostęp do Firestore, Firebase Auth i Firebase Storage — bez dodatkowej konfiguracji uprawnień. Triggery oparte na zdarzeniach Firestore (`onDocumentCreated`, `onDocumentUpdated`) zastępują webhooki Make bez potrzeby wystawiania publicznych endpointów.

Serverless model jest zgodny z resztą stacku — zero zarządzania serwerem, płatność tylko za wykonanie.

### Przypadki użycia w aplikacji

- **Email powitalny** — trigger po rejestracji nowego użytkownika w Firebase Auth
- **Onboarding** — automatyczne tworzenie struktury kolekcji Firestore po pierwszym logowaniu
- **Powiadomienie o limicie dokumentów** — trigger gdy `documents count >= 45` (alert przed limitem 50)
- **Cleanup** — usuwanie chunków z Firestore po usunięciu dokumentu przez użytkownika
- **Webhook Stripe** — obsługa zdarzeń subskrypcji (aktywacja, anulowanie, nieudana płatność)

### Kompromisy

- Cold start przy rzadkich wywołaniach (100–500ms) — nieistotne dla triggerów w tle, monitorować dla krytycznych ścieżek
- Limit czasu wykonania (540s dla funkcji 1. generacji) — wystarczający dla wszystkich opisanych przypadków użycia
- Lokalny development wymaga Firebase Emulator Suite — jednorazowy setup, dobrze udokumentowany

### Mapa przejścia Etap 1 → Etap 2

| Funkcja                 | Etap 1 (Make)             | Etap 2 (Cloud Functions)                   |
| ----------------------- | ------------------------- | ------------------------------------------ |
| Email powitalny         | Make scenario → SendGrid  | `onUserCreate` trigger → SendGrid / Resend |
| Onboarding Firestore    | Make → Firestore HTTP API | `onUserCreate` trigger → Firestore SDK     |
| Webhook Stripe          | Make → Firestore HTTP API | Dedicated HTTPS function → Firestore SDK   |
| Alert limitu dokumentów | Brak                      | `onDocumentCreated` trigger → email        |

---

## 9. Hosting — Vercel + Firebase

> **Wybrano:** Vercel (Next.js) + Firebase (backend services)
> **Alternatywy:** _Railway, Render, AWS Amplify, Fly.io_

### Dlaczego Vercel

Vercel jest naturalnym hostem dla Next.js — zero konfiguracji deploymentu, automatyczny preview per branch, edge CDN globalnie. Free tier (Hobby) jest wystarczający na wczesne etapy produktu z kilkoma użytkownikami.

Połączenie Vercel + Firebase to sprawdzony duet: Next.js na Vercel, wszystkie backend services na Firebase — bez żadnego serwera do zarządzania.

### Kompromisy

- Vercel Hobby ma limity (100GB bandwidth, brak team features) — przy wzroście upgrade do Pro ($20/msc)
- Serverless funkcje na Vercel mają cold start — nieistotne dla rzadkich requestów na MVP

---

## 10. Płatności — Stripe

> **Wybrano:** Stripe
> **Alternatywy:** _Paddle, LemonSqueezy, Gumroad_

### Dlaczego Stripe

Standard branżowy dla SaaS. Integracja z Next.js przez `stripe` npm package jest dobrze udokumentowana i szybka. Webhooks do zarządzania statusem subskrypcji (aktywna/anulowana) są niezawodne — obsługiwane przez Firebase Cloud Functions (sekcja 8).

Na MVP jeden plan ($19/msc) + Free Trial (7 dni, bez karty). Stripe Checkout eliminuje potrzebę budowania własnego formularza płatności — krytyczne dla bezpieczeństwa i szybkości wdrożenia.

### Kompromisy

- Prowizja 2.9% + $0.30 per transakcja — przy $19/msc to ~$0.85, akceptowalne
- Paddle/LemonSqueezy obsługują VAT/podatki globalnie lepiej — rozważyć przy ekspansji poza US/EU

---

## Podsumowanie decyzji

| Kryterium                    | Waga na MVP | Jak stack to spełnia                                                    |
| ---------------------------- | ----------- | ----------------------------------------------------------------------- |
| Szybkość wdrożenia           | Krytyczna   | Firebase eliminuje konfigurację backendu, Vercel eliminuje DevOps       |
| Koszt miesięczny             | Wysoka      | Free tiers pokrywają 0–100 userów; Google Cloud limit $20 jako hard cap |
| Izolacja danych per user     | Krytyczna   | Firestore security rules + Firebase Auth uid — wbudowane w bazę         |
| Skalowalność                 | Średnia     | Świadome kompromisy z planem migracji na każdą warstwę                  |
| Czas do płatnego użytkownika | Najwyższa   | Cały stack deployowalny w < 2 tygodnie przez solo developera            |

---

## Mapa migracji (gdy urosniemy)

Każda migracja jest niezależna — można je robić po kolei w odpowiedzi na konkretny ból, nie z góry.

| Warstwa       | Teraz (MVP)                   | Przy skalowaniu                | Trigger                                          |
| ------------- | ----------------------------- | ------------------------------ | ------------------------------------------------ |
| Vector Search | Firestore + cosine similarity | Pinecone / pgvector            | > 2000 chunków lub latencja > 500ms              |
| Automatyzacje | Firebase Cloud Functions      | Bez zmian lub Inngest          | Złożoność logiki przekracza możliwości Functions |
| Autentykacja  | Firebase Auth                 | Bez zmian lub Clerk            | Potrzeba enterprise SSO                          |
| Chat AI       | Gemini 1.5 Flash              | Bez zmian lub fine-tuned model | Jakość odpowiedzi niewystarczająca               |
| Hosting       | Vercel Hobby                  | Vercel Pro / Railway           | > 100GB bandwidth / msc                          |
| Pliki         | Firebase Storage              | Cloudflare R2                  | Koszty storage > $20/msc                         |

> _Zasada: nie migruj zanim nie boli. Każda z powyższych migracji to 1–3 dni pracy — robimy je reaktywnie, nie proaktywnie._

---
