import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MindMapsTab } from "@/src/features/mind-maps/MindMapsTab";
import { mindmaps as enMindmaps } from "@/src/i18n/locales/en/mindmaps";
import { mindmaps as plMindmaps } from "@/src/i18n/locales/pl/mindmaps";
import i18n, { setLanguage } from "@/src/i18n";

function emptyMapsFetch() {
  return vi.fn(async () => ({
    ok: true,
    json: async () => [] as const,
  })) as unknown as (url: string, options?: RequestInit) => Promise<Response>;
}

afterEach(async () => {
  cleanup();
  await act(async () => {
    await setLanguage("pl");
  });
});

describe("MindMapsTab po angielsku", () => {
  test("pusta lista EN / PL", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    render(<MindMapsTab apiFetch={emptyMapsFetch()} title="Mind maps" />);
    expect(await screen.findByText(enMindmaps.mindMapsNoMaps)).toBeInTheDocument();

    await act(async () => {
      await setLanguage("pl");
    });
    expect(await screen.findByText(plMindmaps.mindMapsNoMaps)).toBeInTheDocument();
  });
});

describe("mindmaps:mindMapsItemsCount plural", () => {
  const translate = i18n.t as unknown as (key: string, options: object) => string;

  test("PL", async () => {
    await act(async () => {
      await setLanguage("pl");
    });
    expect(translate("mindmaps:mindMapsItemsCount", { count: 1 })).toBe("1 element");
    expect(translate("mindmaps:mindMapsItemsCount", { count: 2 })).toBe("2 elementy");
    expect(translate("mindmaps:mindMapsItemsCount", { count: 5 })).toBe("5 elementów");
  });

  test("EN", async () => {
    await act(async () => {
      await setLanguage("en");
    });
    expect(translate("mindmaps:mindMapsItemsCount", { count: 1 })).toBe("1 item");
    expect(translate("mindmaps:mindMapsItemsCount", { count: 2 })).toBe("2 items");
  });
});
describe("liczba liści: plural PL", () => {
  test("odmienia liść / liście / liści", () => {
    const translate = i18n.t as unknown as (key: string, options: object) => string;
    const leaves = (count: number) => translate("mindmaps:mindMapsLeafCount", { count, lng: "pl" });
    expect(leaves(1)).toBe("1 liść");
    expect(leaves(2)).toBe("2 liście");
    expect(leaves(5)).toBe("5 liści");
    expect(leaves(22)).toBe("22 liście");
  });
});
