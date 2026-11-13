# Kokpit K3: Inbox

**Cel:** szybki zapis myśli, linku, snippetu lub buga z Kokpitu (Alt+I) do `Inbox/inbox.md`; kafel „Inbox” z liczbą otwartych wpisów i panel z listą.

**Decyzje (domyślne, 2026-11-13):** nowy kontekst `contexts/bc_inbox/` (5 plików). Plik `Inbox/inbox.md`, jedna linia = jeden wpis: `- [ ] <tekst> [type:: link] [at:: 2026-11-13T21:40]`; `[x]` = posegregowane (znika z listy i licznika, wpis zostaje w pliku). Typ rozpoznawany z tekstu: URL → `link`; prefiks `bug:` → `bug`; prefiks `snippet:`/`kod:` → `snippet`; reszta `myśl` (prefiks jest zdejmowany). Tekst jednoliniowy, do 500 znaków. Linie dopisane ręcznie bez pól `type`/`at` są czytane jako `myśl`. Id wpisu = skrót linii (+ numer powtórzenia). Zapis przez `updateVaultFile` (dopisanie na końcu, nigdy nie przepisujemy cudzej treści poza zmianą znacznika `[ ]`→`[x]`).

## Interfejsy

```ts
// models.ts
type InboxType = "myśl" | "link" | "bug" | "snippet";
type InboxItem = { id: string; text: string; type: InboxType; at: string | null };
// repositories.ts
readOpenItems(): InboxItem[]                 // otwarte, w kolejności pliku
appendItem(item: Omit<InboxItem,"id">): Promise<void>
resolveItem(id: string): Promise<boolean>    // false, gdy nie ma otwartego wpisu o tym id
// services.ts
addItem(text: string, now?: Date): Promise<InboxItem>
listItems(): InboxItem[]                      // najnowsze pierwsze
resolve(id: string): Promise<void>            // NotFoundError, gdy brak
countOpen(): number
// API: GET /api/inbox, POST /api/inbox {text}, PATCH /api/inbox/[id] (oznacza jako posegregowane)
// Cockpit: pole `inbox: { open: number } | null` (null + ostrzeżenie przy błędzie pliku)
```

## UI

Kafel „Inbox” (liczba, „do segregacji wieczorem” / „pusto”), panel w Kokpicie (pole „Myśl, link, snippet albo bug…”, lista otwartych z odznaką typu i przyciskiem „Gotowe”), skrót Alt+I (`useCardHotkeys.onCaptureInbox`): przechodzi na Kokpit i ustawia fokus w polu.
