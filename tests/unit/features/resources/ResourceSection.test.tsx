import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResourceSection } from "@/src/features/resources/ResourceSection";

afterEach(cleanup);

const data = [
  {
    id: "1",
    description: "d1",
    url: "https://a.com",
    title: "Alfa",
    tags: ["x"],
    thumbnailUrl: "https://i",
  },
  {
    id: "2",
    description: "d2",
    url: "https://b.com",
    title: "Beta",
    tags: ["y"],
    thumbnailUrl: "https://i",
  },
];

function setup() {
  const apiFetch = vi.fn(async () => ({ ok: true, json: async () => data }) as Response);
  render(<ResourceSection apiFetch={apiFetch} />);
  return screen.findByText("Alfa");
}

describe("ResourceSection", () => {
  it("Esc czyści zapytanie wyszukiwarki", async () => {
    await setup();
    const user = userEvent.setup();
    const search = screen.getByRole("searchbox");
    await user.type(search, "beta");
    expect(screen.queryByText("Alfa")).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.getByText("Alfa")).toBeInTheDocument());
    expect(search).toHaveValue("");
  });

  it("/ ustawia fokus na wyszukiwarce", async () => {
    await setup();
    const user = userEvent.setup();
    await user.click(document.body);
    await user.keyboard("/");
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  it("pole URL formularza pojawia się dopiero po rozwinięciu", async () => {
    await setup();
    const user = userEvent.setup();
    expect(screen.queryByPlaceholderText("URL")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /opis/i }));
    expect(screen.getByPlaceholderText("URL")).toBeInTheDocument();
  });
});
