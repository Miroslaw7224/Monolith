import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { PrRow } from "@/src/features/home/PrRow";
import { formatShortDate, formatTime } from "@/src/i18n/format";

afterEach(cleanup);

const UPDATED = "2026-11-16T05:58:28Z";

describe("PrRow", () => {
  test("link do PR z repo#numer i tytułem, pełny tekst w title, bezpieczne atrybuty", () => {
    render(
      <ul>
        <PrRow
          repo="o/r"
          number={5}
          title="Bardzo długi tytuł"
          url="https://github.com/o/r/pull/5"
          updatedAt={UPDATED}
          refClassName="kok-reviews__ref--ready"
        >
          <span>status</span>
        </PrRow>
      </ul>
    );
    const link = screen.getByRole("link", { name: /o\/r#5/ });
    expect(link.getAttribute("href")).toBe("https://github.com/o/r/pull/5");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("title")).toBe("o/r#5 Bardzo długi tytuł");
    expect(screen.getByText("o/r#5").className).toContain("kok-reviews__ref--ready");
    expect(screen.getByText("Bardzo długi tytuł").className).toContain("kok-pr-row__title");
  });

  test("kolumny: status (children) i data z godziną", () => {
    render(
      <ul>
        <PrRow
          repo="o/r"
          number={5}
          title="T"
          url="https://github.com/o/r/pull/5"
          updatedAt={UPDATED}
        >
          <span>status</span>
        </PrRow>
      </ul>
    );
    expect(screen.getByText("status").closest(".kok-pr-row__cell")).toBeTruthy();
    const when = new Date(UPDATED);
    expect(screen.getByText(`${formatShortDate(when)} ${formatTime(when)}`).className).toContain(
      "kok-pr-row__when"
    );
  });
});
