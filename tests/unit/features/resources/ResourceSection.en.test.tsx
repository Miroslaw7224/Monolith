import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ResourceSection } from "@/src/features/resources/ResourceSection";
import { setLanguage } from "@/src/i18n";
import i18n from "@/src/i18n";
import { resources as enResources } from "@/src/i18n/locales/en/resources";
import { resources as plResources } from "@/src/i18n/locales/pl/resources";

const data = [
  {
    id: "1",
    description: "d1",
    url: "https://a.com",
    title: "Alfa",
    tags: ["x"],
    thumbnailUrl: "https://i",
  },
];

function apiFetch() {
  return vi.fn(async () => ({ ok: true, json: async () => data }) as Response);
}

afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguage("pl");
  });
});

describe("ResourceSection po angielsku", () => {
  test("placeholder wyszukiwarki EN / PL", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    render(<ResourceSection apiFetch={apiFetch()} />);
    const search = screen.getByRole("searchbox");
    expect(search).toHaveAttribute("placeholder", enResources.resourceSearchPlaceholder);

    await act(async () => {
      await setLanguage("pl");
    });
    expect(search).toHaveAttribute("placeholder", plResources.resourceSearchPlaceholder);
  });
});

describe("resources:resourceAdded plural", () => {
  // Rzutowanie: klucz składany w teście (np. `planning:${key}`) nie pasuje do unionu znanych kluczy w typach `i18n.t` (TS2345 bez rzutowania).
  const translate = i18n.t as unknown as (key: string, options: object) => string;

  test("PL", () => {
    expect(translate("resources:resourceAdded", { count: 1, lng: "pl" })).toBe("Dodano 1 zasób");
    expect(translate("resources:resourceAdded", { count: 2, lng: "pl" })).toBe("Dodano 2 zasoby");
    expect(translate("resources:resourceAdded", { count: 5, lng: "pl" })).toBe("Dodano 5 zasobów");
    expect(translate("resources:resourceAdded", { count: 22, lng: "pl" })).toBe("Dodano 22 zasoby");
  });

  test("EN", () => {
    expect(translate("resources:resourceAdded", { count: 1, lng: "en" })).toBe("Added 1 resource");
    expect(translate("resources:resourceAdded", { count: 2, lng: "en" })).toBe("Added 2 resources");
  });
});

describe("resources:resourceSubtitle plural PL", () => {
  // Rzutowanie: klucz składany w teście (np. `planning:${key}`) nie pasuje do unionu znanych kluczy w typach `i18n.t` (TS2345 bez rzutowania).
  const translate = i18n.t as unknown as (key: string, options: object) => string;

  test("odmienia zasób / zasoby / zasobów", () => {
    const sub = (count: number) => translate("resources:resourceSubtitle", { count, lng: "pl" });
    expect(sub(1)).toBe("1 zasób · baza linków i dokumentacji");
    expect(sub(2)).toBe("2 zasoby · baza linków i dokumentacji");
    expect(sub(5)).toBe("5 zasobów · baza linków i dokumentacji");
  });
});
