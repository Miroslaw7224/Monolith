import { describe, expect, it } from "vitest";
import {
  getTaskEnergy,
  setTaskEnergy,
  toggleTaskEnergy,
} from "@/src/features/tasks/taskEnergyUtils";

describe("getTaskEnergy", () => {
  it("rozpoznaje #deep i #quick w dowolnym miejscu tytułu", () => {
    expect(getTaskEnergy("Kurs Playwright #deep")).toBe("deep");
    expect(getTaskEnergy("#quick lista zasad")).toBe("quick");
    expect(getTaskEnergy("lista #QUICK zasad")).toBe("quick");
  });

  it("zwraca null bez tagu i dla tagów będących częścią innego słowa", () => {
    expect(getTaskEnergy("Alpha")).toBeNull();
    expect(getTaskEnergy("zadanie #deeper")).toBeNull();
    expect(getTaskEnergy("mail#quick")).toBeNull();
  });
});

describe("setTaskEnergy", () => {
  it("dopisuje tag na końcu tytułu", () => {
    expect(setTaskEnergy("Alpha", "deep")).toBe("Alpha #deep");
  });

  it("zamienia istniejący tag i zostawia resztę tytułu", () => {
    expect(setTaskEnergy("lista #quick zasad", "deep")).toBe("lista zasad #deep");
  });

  it("usuwa tag dla null i porządkuje spacje", () => {
    expect(setTaskEnergy("lista #quick zasad", null)).toBe("lista zasad");
    expect(setTaskEnergy("Alpha #deep", null)).toBe("Alpha");
  });

  it("dla pustego tytułu daje sam tag albo pusty napis", () => {
    expect(setTaskEnergy("", "quick")).toBe("#quick");
    expect(setTaskEnergy("", null)).toBe("");
  });
});

describe("toggleTaskEnergy", () => {
  it("włącza, przełącza i wyłącza tag", () => {
    expect(toggleTaskEnergy("Alpha", "deep")).toBe("Alpha #deep");
    expect(toggleTaskEnergy("Alpha #deep", "quick")).toBe("Alpha #quick");
    expect(toggleTaskEnergy("Alpha #deep", "deep")).toBe("Alpha");
  });
});
