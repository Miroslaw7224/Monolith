# Archiwum ADR

Pliki w tym katalogu są zarchiwizowane: ich decyzje zostały wchłonięte do innych ADR-ów lub są superseded (obecny stan aplikacji odbiega od decyzji). Zachowane dla historii i odniesień.

**Migracja na Next.js (luty 2026):** Stack aplikacji to Next.js 14 z App Router. ADR-001 i ADR-009 odnoszą się do tej migracji — decyzja o Next.js i Vercel jest zrealizowana.

| Plik                               | Powód archiwizacji                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| 001-nextjs-app-router.md           | Zrealizowany — migracja na Next.js wykonana; stack to Next.js 14 App Router         |
| 004-firebase-storage.md            | Wchłonięty do ADR-003 (podsekcja Firebase Storage)                                  |
| 005-gemini-embedding.md            | Wchłonięty do ADR-011 (RAG + retrieval + embeddingi)                                |
| 007-cosine-similarity-firestore.md | Wchłonięty do ADR-011                                                               |
| 008-firebase-cloud-functions.md    | Treść w ADR-017 (Plany na Etap 2)                                                   |
| 009-vercel-hosting.md              | Zaakceptowany po migracji — aplikacja na Next.js, hosting na Vercel aktualny        |
| 010-firestore-from-stage-one.md    | Wchłonięty do ADR-013                                                               |
| 012-stripe-payments.md             | Treść w ADR-017 (Plany na Etap 2)                                                   |
| 002-firebase-auth.md               | Zastąpiony przez ADR-020 (lokalne pliki zamiast Firestore, bez logowania)           |
| 003-firestore-database.md          | Zastąpiony przez ADR-020                                                            |
| 006-gemini-flash-llm.md            | Era Firebase/Gemini; aplikacja nie wywołuje już modelu po API (etap A1)             |
| 011-rag-architecture.md            | Unieważniony: moduł Wiedza (RAG) usunięty z aplikacji                               |
| 016-firestore-emulator-docker.md   | Zastąpiony przez ADR-020; emulator i testy integracyjne usunięte (etap 0e)          |
| CURSOR-TASK-mind-maps.md           | Robocze zadanie dla Cursora (mapy myśli), nie decyzja; wdrożone (ADR-017-mind-maps) |
