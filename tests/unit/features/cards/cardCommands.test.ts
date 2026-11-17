import { test, expect, vi } from "vitest";
import i18n from "@/src/i18n";
import { buildCardCommands } from "@/src/features/cards/cards";

test("buduje 10 komend Przejdź z podpowiedzią skrótu", () => {
  const selectCard = vi.fn();
  const cmds = buildCardCommands(selectCard, i18n.t);
  expect(cmds).toHaveLength(10);
  expect(cmds[5]).toMatchObject({ id: "go-plotno", label: "Przejdź: Płótno", hint: "Alt+6" });
  cmds[5].run();
  expect(selectCard).toHaveBeenCalledWith("plotno");
});

test("ostatnia komenda przechodzi do Kodeksu z hintem Alt+9", () => {
  const selectCard = vi.fn();
  const cmds = buildCardCommands(selectCard, i18n.t);
  expect(cmds[8]).toMatchObject({ id: "go-kodeks", label: "Przejdź: Kodeks", hint: "Alt+9" });
  cmds[8].run();
  expect(selectCard).toHaveBeenCalledWith("kodeks");
});

test("ostatnia komenda przechodzi do Diagnostyki z hintem Alt+0", () => {
  const selectCard = vi.fn();
  const cmds = buildCardCommands(selectCard, i18n.t);
  expect(cmds[9]).toMatchObject({
    id: "go-diagnostyka",
    label: "Przejdź: Diagnostyka",
    hint: "Alt+0",
  });
  cmds[9].run();
  expect(selectCard).toHaveBeenCalledWith("diagnostyka");
});

test("po angielsku: Go to: Canvas", () => {
  const cmds = buildCardCommands(vi.fn(), i18n.getFixedT("en"));
  expect(cmds[5]).toMatchObject({ id: "go-plotno", label: "Go to: Canvas", hint: "Alt+6" });
});
