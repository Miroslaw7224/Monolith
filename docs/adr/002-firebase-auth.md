# ADR-002: Firebase Auth dla autentykacji

## Status

Zastąpiony przez [ADR-020](020-lokalne-pliki-zamiast-firestore.md)

## Kontekst

Second Brain wymaga autentykacji użytkowników — izolacja danych per user jest kluczowa (freelancer widzi wyłącznie swoje dokumenty). Potrzebujemy logowania przez email oraz Google OAuth. Na MVP priorytetem jest szybkość wdrożenia — czas do działającego flow poniżej 1 godziny.

Integracja z Firestore jest krytyczna: reguły bezpieczeństwa muszą bazować na `request.auth.uid`, aby zapewnić izolację dokumentów per użytkownik bez ręcznej implementacji w API.

## Decyzja

Wybieramy **Firebase Auth** jako system autentykacji. Email + Google OAuth, bez własnej bazy users — Firebase zarządza sesjami, tokenami i bezpieczeństwem. Reguły Firestore oparte na `request.auth.uid` zapewniają izolację danych wbudowaną w bazę.

## Rozważane alternatywy

- **NextAuth.js** — wymaga własnej konfiguracji providerów i integracji z Firestore
- **Supabase Auth** — spójny z Supabase; projekt używa Firebase jako backend
- **Clerk** — wygodny, ale dodatkowy serwis i billing; nadmiarowy na MVP

## Konsekwencje

**Pozytywne:**

- Czas wdrożenia < 1 godzina — krytyczne na MVP
- Natywna integracja z Firestore — reguły bezpieczeństwa bez dodatkowego kodu
- Brak własnej bazy users — Firebase zarządza sesjami
- Izolacja danych per `uid` wbudowana w ekosystem

**Negatywne:**

- Silny lock-in w ekosystem Google — celowy wybór na MVP
- Migracja do własnego auth w przyszłości wymagałaby pracy — akceptowalne

## Stan aplikacji (luty 2026)

Wdrożone: Firebase Auth (email+hasło, Google, logowanie anonimowe). Frontend: `firebase/auth` (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signInWithPopup`, `signInAnonymously`), `onAuthStateChanged`, nagłówek `Authorization: Bearer <idToken>`. Backend: weryfikacja tokena w każdym Route Handlerze przez `getAuthUserId(request)` (`lib/getAuth.ts` wywołuje `verifyIdToken` z `lib/firebase-admin.ts`); trasy API w `app/api/`. Reguły Firestore: `users/{userId}/**` z `request.auth.uid == userId`.
