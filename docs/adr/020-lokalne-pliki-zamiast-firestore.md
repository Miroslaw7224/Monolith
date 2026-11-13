# ADR-020: Lokalne pliki zamiast Firestore, bez logowania

## Status

Zaakceptowany (2026-11-12). Zastępuje ADR-002 (Firebase Auth), ADR-003 (Firestore) i ADR-016 (emulator Firestore w Dockerze; ten ostatni w pełni dopiero w etapie 0e).

## Kontekst

Monolith (dawniej Second Brain) jest używany przez jedną osobę i staje się lokalnym asystentem pracy w ekosystemie NEXUS. Źródłem prawdy o projektach jest vault Markdown/YAML (`NEXUS_VAULT_PATH`). Logowanie, izolacja danych per użytkownik, chmurowa baza i wdrożenie na Vercelu nie mają już odbiorcy, a utrzymanie ich kosztuje: osobne konto, konfigurację, limity odczytów i drugi system przechowywania danych.

## Decyzja

- Dane aplikacji żyją w plikach Markdown/YAML w vaultcie, obsługiwanych przez `lib/nexus` (repozytoria) i warstwę serwisów. Zapisy aplikacji trafiają wyłącznie do `Vault/`.
- Brak logowania i brak `userId`: aplikacja ma jednego, lokalnego użytkownika. `/` przekierowuje do `/dashboard`.
- Serwer działa tylko na `127.0.0.1` (`next dev -H 127.0.0.1`, `next start -H 127.0.0.1`). Zamiast auth chroni go `middleware.ts` z `lib/localGuard.ts`: obcy `Host` jest odrzucany (DNS rebinding), a żądania zmieniające stan wymagają `Sec-Fetch-Site: same-origin`, zgodnego `Origin` albo nagłówka `X-Nexus-Client: 1` (dla curl i skryptów).
- Klient nie używa żadnego kodu Firebase; pakiet `firebase` został usunięty. Waitlista, landing i strony prawne zostały usunięte.
- Testy e2e działają na tymczasowym vaulcie i własnym serwerze (port 3199), nigdy na prawdziwych danych.

## Konsekwencje

- Brak wielu użytkowników i brak dostępu zdalnego. Ochrona portu opiera się na strażniku lokalnym, a nie na tożsamości.
- Etap 0e zakończony (2026-11-13): `firebase-admin`, skrypty eksportu i migracji, emulator i testy integracyjne usunięte; projekt Vercel usunięty, projekt Firebase wygaszany ręcznie w konsoli. Dane spoza zakresu migracji (kalendarz, mapy myśli, historia agenta) nie były przenoszone, co jest świadomą decyzją użytkownika. Surowy zrzut leży lokalnie poza repo; `scripts/import-to-vault.ts` odtwarza z niego vault.
- Klucze `localStorage` (aktywna sesja pracy, widok tablicy) nie zależą już od identyfikatora użytkownika; po zmianie jednorazowo przepadają stare wartości.

## Powiązane dokumenty

- `docs/superpowers/specs/2026-11-12-etap-0-odpiecie-firebase-design.md`
- `docs/superpowers/plans/2026-11-12-etap-0d-1-lokalny-serwer-bez-auth-i-userid.md`
- `docs/superpowers/plans/2026-11-12-etap-0d-2-klient-bez-logowania-i-sprzatanie.md`
