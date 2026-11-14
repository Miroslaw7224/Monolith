import { describe, test, expect } from "vitest";
import {
  CARDS,
  getCard,
  cardByHotkey,
  cardForView,
  cardFromHash,
  filterCommands,
  CARD_SUBTABS,
  subtabsForCard,
} from "@/src/features/cards/cards";

describe("CARDS", () => {
  test("ma 9 kart z klawiszami 1..9 w kolejności", () => {
    expect(CARDS.map((c) => c.hotkey)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(CARDS.map((c) => c.id)).toEqual([
      "kokpit",
      "kalendarz",
      "zadania",
      "projekty",
      "notatki",
      "plotno",
      "arsenal",
      "mapa",
      "kodeks",
    ]);
  });

  test("mapa ma własny widok, kodeks to zaślepka", () => {
    expect(getCard("mapa").target).toEqual({ kind: "map" });
    expect(getCard("kodeks").target).toEqual({ kind: "placeholder", stage: "po etapie 0c" });
  });

  test("projekty celuje w widok projects", () => {
    expect(getCard("projekty").target).toEqual({ kind: "projects" });
  });

  test("Kodeks jest ostatnią kartą z etykietą Kodeks", () => {
    expect(CARDS[CARDS.length - 1]).toMatchObject({ id: "kodeks", label: "Kodeks", hotkey: 9 });
  });
});

describe("cardByHotkey", () => {
  test("zwraca kartę dla 1..9 i undefined poza zakresem", () => {
    expect(cardByHotkey(3)?.id).toBe("zadania");
    expect(cardByHotkey(9)?.id).toBe("kodeks");
    expect(cardByHotkey(10)).toBeUndefined();
    expect(cardByHotkey(0)).toBeUndefined();
  });
});

describe("cardForView", () => {
  test("home to kokpit niezależnie od zakładki", () => {
    expect(cardForView("home", "notes")).toBe("kokpit");
  });

  test("zakładki planowania mapują się na karty", () => {
    expect(cardForView("planowanie", "calendar")).toBe("kalendarz");
    expect(cardForView("planowanie", "tasks")).toBe("zadania");
    expect(cardForView("planowanie", "notes")).toBe("notatki");
    expect(cardForView("planowanie", "board")).toBe("plotno");
    expect(cardForView("planowanie", "mindmaps")).toBe("plotno");
    expect(cardForView("planowanie", "resources")).toBe("arsenal");
    expect(cardForView("planowanie", "tags")).toBe("arsenal");
    expect(cardForView("planowanie", "activity")).toBe("kalendarz");
  });
});

describe("cardFromHash", () => {
  test("rozpoznaje znane karty z # i bez", () => {
    expect(cardFromHash("#notatki")).toBe("notatki");
    expect(cardFromHash("mapa")).toBe("mapa");
    expect(cardFromHash("#kodeks")).toBe("kodeks");
  });

  test("zwraca null dla pustego i nieznanego", () => {
    expect(cardFromHash("")).toBeNull();
    expect(cardFromHash("#settings")).toBeNull();
  });
});

describe("filterCommands", () => {
  const cmds = [
    { id: "a", label: "Przejdź: Płótno", run: () => {} },
    { id: "b", label: "Przejdź: Arsenał", run: () => {} },
  ];

  test("pusta fraza zwraca wszystko", () => {
    expect(filterCommands(cmds, "  ")).toHaveLength(2);
  });

  test("ignoruje wielkość liter i polskie znaki", () => {
    expect(filterCommands(cmds, "PLOTNO").map((c) => c.id)).toEqual(["a"]);
    expect(filterCommands(cmds, "arsenal").map((c) => c.id)).toEqual(["b"]);
  });
});

describe("subtabsForCard", () => {
  test("subtabsForCard('plotno') = ['board','mindmaps'], 'arsenal' = ['resources','tags'], 'kokpit' = []", () => {
    expect(subtabsForCard("plotno")).toEqual(["board", "mindmaps"]);
    expect(subtabsForCard("arsenal")).toEqual(["resources", "tags"]);
    expect(subtabsForCard("kokpit")).toEqual([]);
  });

  test("CARD_SUBTABS zawiera tylko karty z podwidokami", () => {
    expect(CARD_SUBTABS).toEqual({
      kalendarz: ["calendar", "activity"],
      plotno: ["board", "mindmaps"],
      arsenal: ["resources", "tags"],
    });
  });
});
