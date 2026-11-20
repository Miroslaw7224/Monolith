import { describe, expect, it } from "vitest";
import i18n from "@/src/i18n";

// Rzutowanie: klucz składany w teście (np. `planning:${key}`) nie pasuje do unionu znanych kluczy w typach `i18n.t` (TS2345 bez rzutowania).
const translate = i18n.t as unknown as (key: string, options: object) => string;
const noun = (key: string, count: number, lng: "pl" | "en") =>
  translate(`planning:${key}`, { count, lng });

describe("liczniki tablicy: plural PL/EN", () => {
  it("odmienia kafelki po polsku", () => {
    expect(noun("boardCountTile", 1, "pl")).toBe("kafelek");
    expect(noun("boardCountTile", 2, "pl")).toBe("kafelki");
    expect(noun("boardCountTile", 5, "pl")).toBe("kafelków");
    expect(noun("boardCountTile", 22, "pl")).toBe("kafelki");
  });

  it("odmienia ramki i połączenia po polsku", () => {
    expect(noun("boardCountFrame", 1, "pl")).toBe("ramka");
    expect(noun("boardCountFrame", 3, "pl")).toBe("ramki");
    expect(noun("boardCountFrame", 0, "pl")).toBe("ramek");
    expect(noun("boardCountEdge", 1, "pl")).toBe("połączenie");
    expect(noun("boardCountEdge", 4, "pl")).toBe("połączenia");
    expect(noun("boardCountEdge", 12, "pl")).toBe("połączeń");
  });

  it("odmienia po angielsku", () => {
    expect(noun("boardCountTile", 1, "en")).toBe("tile");
    expect(noun("boardCountTile", 2, "en")).toBe("tiles");
  });
});
