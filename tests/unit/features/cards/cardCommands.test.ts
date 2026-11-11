import { test, expect, vi } from "vitest";
import { buildCardCommands } from "@/src/features/cards/cards";

test("buduje 8 komend Przejdź z podpowiedzią skrótu", () => {
  const selectCard = vi.fn();
  const cmds = buildCardCommands(selectCard);
  expect(cmds).toHaveLength(8);
  expect(cmds[5]).toMatchObject({ id: "go-plotno", label: "Przejdź: Płótno", hint: "Alt+6" });
  cmds[5].run();
  expect(selectCard).toHaveBeenCalledWith("plotno");
});
