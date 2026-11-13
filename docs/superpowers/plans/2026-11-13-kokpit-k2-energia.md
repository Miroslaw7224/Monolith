# Kokpit K2: energia Deep/Quick

**Decyzja (2026-11-13):** energia nie jest osobnym polem w plikach, tylko znacznikiem w tekście zadania, który Kokpit rozpoznaje przy odczycie: tag `#deep` / `#quick` (jak w makiecie 03-zadania) albo `[energy:: deep]`. Powód: `tasks.md` projektów jest edytowany bajt w bajt, a zadania ogólne gubiłyby nieznane pola `[x::]` przy przepisaniu przez formularz. Ustawianie energii = dopisanie tagu w tytule zadania w istniejących edytorach (tablica zadań projektu, formularz zadania, Obsidian).

**Zakres:** `extractEnergy` w `bc_cockpit/services.ts` (pierwszy znacznik wygrywa; tytuł w kolejce bez znaczników), `QueueItem.energy`, odznaka na pozycji kolejki, filtr wszystko/deep/quick (tylko gdy jakieś zadanie ma energię), podsumowanie „N deep · M quick” w kafelku „Kolejka zadań”.

**Poza zakresem (możliwy K2b):** przełącznik energii bezpośrednio na pozycji kolejki (wymaga operacji `edit` osobno dla `tasks.md` i dla zadań ogólnych) oraz osobne pole `energy` w formularzu zadania ogólnego.
