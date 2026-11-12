import { test, expect, vi } from "vitest";
import { buildCardCommands } from "@/src/features/cards/cards";

test("buduje 9 komend Przejdź z podpowiedzią skrótu", () => {
  const selectCard = vi.fn();
  const cmds = buildCardCommands(selectCard);
  expect(cmds).toHaveLength(9);
  expect(cmds[5]).toMatchObject({ id: "go-plotno", label: "Przejdź: Płótno", hint: "Alt+6" });
  cmds[5].run();
  expect(selectCard).toHaveBeenCalledWith("plotno");
});

test("ostatnia komenda przechodzi do Kodeksu z hintem Alt+9", () => {
  const selectCard = vi.fn();
  const cmds = buildCardCommands(selectCard);
  expect(cmds[8]).toMatchObject({ id: "go-kodeks", label: "Przejdź: Kodeks", hint: "Alt+9" });
  cmds[8].run();
  expect(selectCard).toHaveBeenCalledWith("kodeks");
});
