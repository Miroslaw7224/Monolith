# Kokpit K6: „Zamknij dzień” i „Zaczep z wczoraj”

**Cel:** wieczorem jedno zdanie („od czego zacząć jutro”) trafia do vaulta; następnego dnia Kokpit pokazuje je na górze jako zaczep. Przy zapisie dołączamy liczbę commitów dnia z K7 (historia dzień po dniu; widok historii to osobny krok K8).

**Decyzje (domyślne, 2026-11-13):** plik `Cockpit/closing.yaml` (lista `days`, jeden wpis na dzień, ponowne zamknięcie tego samego dnia nadpisuje wpis). Zaczep = najnowszy wpis z datą wcześniejszą niż dziś (nie tylko z wczoraj; etykieta mówi, z kiedy). Tekst: 1 zdanie, do 300 znaków, nowe linie zamieniane na spację. Opcjonalny `projectId` (z rejestru) daje przycisk „Wejdź w temat”.

## Interfejsy

```ts
// bc_cockpit/models.ts
export type Closing = { date: string; text: string; projectId: string | null; commits: number | null };
export type Cockpit = { /* … */ closing: { anchor: Closing | null; today: Closing | null } };
// repositories.ts
readClosings(): Closing[]            // posortowane rosnąco po date; wpisy bez poprawnej date/text pomijane
upsertClosing(c: Closing): Promise<void>
// services.ts
closeDay(input: { text: string; projectId: string | null }, today?: Date): Promise<Closing>
// schemas.ts
ClosingInputSchema = { text: string (trim, 1–300), projectId?: string | null }
// router: PUT /api/cockpit/closing → ClosingDto
```

## Przypadki testowe

- repo: brak pliku → `[]`; zapis i odczyt; ten sam `date` nadpisuje; kolejność rosnąca; uszkodzony wpis pominięty.
- service: `closeDay` zapisuje `date = localDate(today)`, `commits` = suma z `listGitActivity` (brak repo → `null`); nieznany `projectId` → `DomainError`; tekst po `trim` pusty → `DomainError`; nowe linie → spacja.
- `getCockpit`: `anchor` = najnowszy wpis z datą < dziś; `today` = wpis z dzisiejszą datą; błąd pliku → ostrzeżenie, `closing` puste.
- UI: pasek zaczepu (etykieta „Zaczep z wczoraj” / „Zaczep z <dnia>”), „Wejdź w temat” woła `onOpenProject`; „Zamknij dzień” otwiera dialog, zapis robi `PUT /api/cockpit/closing` i odświeża; po zamknięciu przycisk pokazuje „Dzień zamknięty · zmień”.
