# ADR-011: Architektura RAG — Retrieval-Augmented Generation

## Status

Unieważniony — moduł Wiedza (RAG, chat po dokumentach) został usunięty z aplikacji. Dokument zachowany jako zapis historycznej decyzji.

## Kontekst

Second Brain ma odpowiadać na pytania freelancerów w oparciu o ich własne dokumenty (notatki, wyceny, ustalenia z klientami). AI nie może halucynować — odpowiedzi muszą być zakotwiczone w rzeczywistej treści dokumentów użytkownika.

Użytkownik musi widzieć źródło każdej odpowiedzi (z jakiego dokumentu pochodzi informacja), aby móc ją zweryfikować.

## Decyzja

Wdrażamy **Retrieval-Augmented Generation (RAG)** jako architekturę odpowiedzi AI.

Pipeline (docelowy, przy pełnym wdrożeniu wektorów):

1. **Chunking** — dokumenty są dzielone na fragmenty (chunki) o ustalonej wielkości
2. **Embedding** — każdy chunk jest wektoryzowany (patrz: Embeddingi na przyszłość)
3. **Similarity search** — zapytanie użytkownika jest embedowane; retrieval zwraca najbliższe chunki (patrz: Strategia retrieval)
4. **Prompt + kontekst** — top-k chunków + zapytanie trafiają do Gemini 1.5 Flash
5. **Odpowiedź** — LLM generuje odpowiedź wyłącznie na podstawie dostarczonego kontekstu
6. **Źródło** — każda odpowiedź zawiera informację o dokumencie źródłowym

AI odpowiada wyłącznie na podstawie dokumentów użytkownika — brak dostępu do wiedzy ogólnej poza kontekstem. Każda odpowiedź cytuje źródło.

---

### Strategia retrieval (obecna i na przyszłość)

**Obecnie (MVP):** Wyszukiwanie po **słowach kluczowych** w treści chunków (keyword filter w `getChunksForSearch`). Zero embeddingów, zero dodatkowego serwisu. Wystarczające przy ~50 dokumentach / ~500–1000 chunków na użytkownika.

**Na przyszłość — opcja A: Cosine similarity w aplikacji**

- Pobierz wszystkie chunki użytkownika z Firestore (`users/{userId}/chunks`)
- Oblicz cosine similarity między wektorem zapytania a każdym wektorem chunka
- Zwróć top-k najbardziej podobnych chunków  
  Bez dodatkowego serwisu. Na ~500–2000 chunków czas < 100ms akceptowalny.

**Próg migracji do vector store:** Gdy użytkownik ma > 2000 chunków LUB latencja search > 500ms — migracja do Pinecone lub pgvector (szac. 1–2 dni). Alternatywy odrzucone na MVP: Pinecone, Weaviate, Qdrant, pgvector (Supabase), Vertex AI Vector Search — więcej złożoności i billingu.

---

### Embeddingi na przyszłość

Gdy wdrożymy similarity search na wektorach:

- **Model:** **Gemini text-embedding-004** — wektory 768-wymiarowe, jeden dostawca z Gemini 1.5 Flash (RAG), limit $20/msc w Google Cloud Console jako hard cap.
- Alternatywy odrzucone: OpenAI text-embedding-3-small (droższy, drugi dostawca), Cohere Embed, modele lokalne (all-MiniLM).
- Interfejs embeddingów abstrahowalny — łatwa zamiana dostawcy w przyszłości.

---

## Rozważane alternatywy

- **Fine-tuning modelu** — zbyt duży koszt i złożoność na MVP; wymaga stale aktualizowanego zbioru treningowego
- **Pełny prompt bez retrieval** — przy wielu dokumentach przekracza limit tokenów; brak precyzyjnego wyszukiwania
- **Hybryda (RAG + wiedza ogólna)** — celowo odrzucona; produkt ma być asystentem pamięci, nie ogólnym chatbotem

## Konsekwencje

**Pozytywne:**

- Odpowiedzi zakotwiczone w rzeczywistych dokumentach — minimalizacja halucynacji
- Źródło każdej odpowiedzi — weryfikowalność dla użytkownika
- Możliwość skalowania bazy wiedzy bez ponownego trenowania modelu
- Prosty flow: chunking → (opcjonalnie embedding) → retrieval → prompt → odpowiedź
- Obecnie: zero embeddingów i vector store — minimalna złożoność na MVP

**Negatywne:**

- Jakość odpowiedzi zależy od chunkingu i jakości retrieval — wymaga iteracji
- Koszt API przy pełnym RAG: embedding + LLM przy każdym zapytaniu — monitorować przy wzroście ruchu

## Stan aplikacji (luty 2026)

Pipeline RAG wdrożony w `services/ragService.ts` (wywoływany z Next.js Route Handlers). **Retrieval:** wyszukiwanie po słowach kluczowych w treści chunków, bez embeddingów. Ekstrakcja słów kluczowych: tokenizacja po białych znakach, normalizacja (lowercase, usunięcie interpunkcji z brzegów), próg długości ≥ 3, stop words PL/EN wg parametru `lang`. **Faza 2a (stemming zapytania):** dla `lang === "pl"` tokeny są stemowane heurystycznie (odcięcie końcówek PL); stem tylko po stronie zapytania — bez zmian w Firestore. Chunking: paragrafy (split po podwójnej newline). Odpowiedź zawiera `text` i `sources` (źródła). Planowanie z kontekstem kalendarza w `planService.ask`. Decyzje o embeddingach (text-embedding-004) i cosine similarity / vector store pozostają aktualne przy ewentualnym wdrożeniu.

**Zastąpione ADR-y:** treść ADR-005 (Gemini embedding) i ADR-007 (cosine similarity) wchłonięta do niniejszego ADR-011.
