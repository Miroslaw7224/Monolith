# ADR-003: Firestore jako główna baza danych

## Status

Zastąpiony przez [ADR-020](020-lokalne-pliki-zamiast-firestore.md)

## Kontekst

Second Brain potrzebuje bazy danych do przechowywania:

- metadanych dokumentów użytkownika,
- chunków tekstu z wektorami embeddingów,
- danych waitlisty i użytkowników (integracja z Firebase Auth).

Na etapie MVP struktura dokumentów może się zmieniać (różne typy notatek, metadane). Priorytetem jest serverless — zero zarządzania serwerem i migracji schematu.

Kluczowy wymóg: wektory embeddingów muszą być przechowywane w sposób umożliwiający similarity search na etapie RAG.

## Decyzja

Wybieramy **Firestore (NoSQL)** jako główną bazę danych.

Struktura kolekcji:

```
users/{userId}/documents/{docId}    → metadane dokumentu
users/{userId}/notes/{noteId}       → notatki użytkownika
users/{userId}/chunks/{chunkId}     → chunk + (opcjonalnie) wektor embeddingu
users/{userId}/mindMaps/{mapId}    → mapy myśli (drzewo w jednym dokumencie — ADR-017)
```

Firestore jest serverless — zero konfiguracji serwera, zero migracji schematu, automatyczne skalowanie. Elastyczność NoSQL pozwala na zmiany struktury bez migracji. Wyszukiwanie kontekstu dla RAG jest realizowane w Next.js (Route Handlers w `app/api/`), bez dedykowanego vector store na MVP.

### Firebase Storage (pliki użytkownika — na przyszłość)

Przy przechowywaniu plików użytkowników (na MVP dokumenty tekstowe, w przyszłości PDF/Word) wybieramy **Firebase Storage** w tym samym ekosystemie co Auth i Firestore. Upload przez Firebase Client SDK — bez własnego presigned URL. Reguły bezpieczeństwa oparte na `request.auth.uid`. Na MVP limit 10MB per plik i 3 pliki jednocześnie wystarczający. Alternatywy odrzucone: Supabase Storage (inny stack), AWS S3, Cloudflare R2 (dodatkowy serwis, brak natywnej integracji z Firebase Auth).

**Stan:** Firebase Storage nie jest wdrożony. Upload dokumentów odbywa się przez Route Handler `app/api/upload`; treść zapisywana w Firestore (documents + chunks). Decyzja pozostaje aktualna przy dodawaniu przechowywania binarnych plików.

**Zastąpiony ADR:** treść ADR-004 (Firebase Storage) wchłonięta jako podsekcja niniejszego ADR-003.

### Firebase Functions (na przyszłość)

W przyszłości możliwa jest konfiguracja **Firebase Functions** (Cloud Functions w ekosystemie Firebase) do automatyzacji po stronie serwera, webhooków lub zadań wyzwalanych zdarzeniami Firestore/Auth. Obecnie logika backendu realizowana jest w Next.js Route Handlers (`app/api/`); ewentualne wdrożenie Functions nie zmienia decyzji o Firestore ani Auth. Szczegóły planów na Etap 2 (w tym Cloud Functions): [ADR-017: Plany na Etap 2](017-plany-etap2.md).

## Rozważane alternatywy

- **PostgreSQL (Supabase)** — wymaga migracji schematu, pgvector dostępny ale dodaje złożoność
- **PlanetScale** — SQL, brak natywnego wsparcia dla wektorów
- **MongoDB Atlas** — podobna elastyczność, mniejsza integracja z Firebase Auth i regułami bezpieczeństwa

## Konsekwencje

**Pozytywne:**

- Serverless — brak DevOps
- Natywne reguły bezpieczeństwa z Firebase Auth (`request.auth.uid`) — izolacja danych per user
- Elastyczna struktura dokumentów — zmiany bez migracji
- Embeddingi jako pola w Firestore — jeden serwis, brak dodatkowego vector store na MVP

**Negatywne:**

- Cosine similarity w kodzie aplikacji wolniejsze niż dedykowany vector store — akceptowalne do ~2000 chunków/user
- Przy skalowaniu (10k+ chunków/user) konieczna migracja do Pinecone lub pgvector — świadomy wybór z progiem migracji

## Stan aplikacji (luty 2026)

Firestore jest jedyną bazą aplikacji (usunięto SQLite). Backend: Next.js Route Handlers w `app/api/` + `lib/firestore-db.ts`. Kolekcje: `users/{uid}/documents`, `users/{uid}/notes`, `users/{uid}/chunks`, `users/{uid}/calendar_events`, `users/{uid}/tasks`, `users/{uid}/user_tags`, **`users/{uid}/mindMaps`** (mapy myśli — jeden dokument na mapę z zagnieżdżonym drzewem węzłów). Zasoby użytkownika: `users/{uid}/resources`. Migracja z SQLite: `scripts/migrate-sqlite-to-firestore.ts`.
