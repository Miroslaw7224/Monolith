import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResourceListItem } from "@/src/features/resources/ResourceListItem";
import type { NoteResource } from "@/src/features/resources/resourceTypes";

function mockResource(overrides?: Partial<NoteResource>): NoteResource {
  return {
    id: "res-1",
    description: "Test description",
    url: "https://example.com",
    title: "Example Title",
    tags: ["tag1", "tag2"],
    isFavorite: false,
    ...overrides,
  };
}

afterEach(cleanup);

describe("ResourceListItem", () => {
  it("renders title, description and tags", () => {
    const resource = mockResource();
    const onOpenEdit = vi.fn();
    const onToggleFavorite = vi.fn();
    const onCopy = vi.fn();
    const onDelete = vi.fn();

    render(
      <ResourceListItem
        resource={resource}
        titleUnavailableLabel="(no title)"
        resourceFavoriteLabel="Toggle favorite"
        resourceEditLabel="Edit"
        onOpenEdit={onOpenEdit}
        onToggleFavorite={onToggleFavorite}
        onCopy={onCopy}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText("Example Title")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
    expect(screen.getByText("tag1")).toBeInTheDocument();
    expect(screen.getByText("tag2")).toBeInTheDocument();
  });

  it("shows url and titleUnavailableLabel when title equals url", () => {
    const resource = mockResource({ title: "https://example.com", url: "https://example.com" });
    render(
      <ResourceListItem
        resource={resource}
        titleUnavailableLabel="(brak tytułu)"
        resourceFavoriteLabel="Ulubione"
        resourceEditLabel="Edytuj"
        onOpenEdit={vi.fn()}
        onToggleFavorite={vi.fn()}
        onCopy={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("https://example.com")).toBeInTheDocument();
    expect(screen.getByText("(brak tytułu)")).toBeInTheDocument();
  });

  it("calls onDelete with resource id when delete button is clicked", async () => {
    const user = userEvent.setup();
    const resource = mockResource({ id: "res-123" });
    const onDelete = vi.fn();

    const { container } = render(
      <ul>
        <ResourceListItem
          resource={resource}
          titleUnavailableLabel="(no title)"
          resourceFavoriteLabel="Favorite"
          resourceEditLabel="Edit"
          onOpenEdit={vi.fn()}
          onToggleFavorite={vi.fn()}
          onCopy={vi.fn()}
          onDelete={onDelete}
        />
      </ul>
    );

    const deleteButton = within(container).getByRole("button", { name: /usuń/i });
    await user.click(deleteButton);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith("res-123");
  });

  it("calls onCopy with url when copy button is clicked", async () => {
    const user = userEvent.setup();
    const resource = mockResource({ url: "https://copy-me.com" });
    const onCopy = vi.fn();

    const { container } = render(
      <ul>
        <ResourceListItem
          resource={resource}
          titleUnavailableLabel="(no title)"
          resourceFavoriteLabel="Favorite"
          resourceEditLabel="Edit"
          onOpenEdit={vi.fn()}
          onToggleFavorite={vi.fn()}
          onCopy={onCopy}
          onDelete={vi.fn()}
        />
      </ul>
    );

    const copyButton = within(container).getByRole("button", { name: /kopiuj url/i });
    await user.click(copyButton);

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledWith("https://copy-me.com");
  });
});

describe("ResourceListItem: otwieranie i edycja", () => {
  const baseProps = {
    titleUnavailableLabel: "(brak)",
    resourceFavoriteLabel: "Ulubione",
    resourceEditLabel: "Edytuj",
    onToggleFavorite: vi.fn(),
    onCopy: vi.fn(),
    onDelete: vi.fn(),
  };

  afterEach(() => vi.restoreAllMocks());

  it("klik w wiersz otwiera URL w nowej karcie i nie otwiera edycji", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const onOpenEdit = vi.fn();
    const user = userEvent.setup();
    render(
      <ul>
        <ResourceListItem
          {...baseProps}
          resource={mockResource({ url: "https://open.me" })}
          onOpenEdit={onOpenEdit}
        />
      </ul>
    );
    await user.click(screen.getByText("Example Title"));
    expect(open).toHaveBeenCalledWith("https://open.me", "_blank", "noopener,noreferrer");
    expect(onOpenEdit).not.toHaveBeenCalled();
  });

  it("wiersz jest linkiem dostępnym z klawiatury: Enter i spacja otwierają URL, nie edycję", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const onOpenEdit = vi.fn();
    const user = userEvent.setup();
    render(
      <ul>
        <ResourceListItem
          {...baseProps}
          resource={mockResource({ url: "https://open.me" })}
          onOpenEdit={onOpenEdit}
        />
      </ul>
    );
    const row = screen.getByRole("link");
    row.focus();
    expect(row).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenLastCalledWith("https://open.me", "_blank", "noopener,noreferrer");
    await user.keyboard(" ");
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenLastCalledWith("https://open.me", "_blank", "noopener,noreferrer");
    expect(onOpenEdit).not.toHaveBeenCalled();
  });

  it("ołówek otwiera edycję i nie otwiera URL", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const onOpenEdit = vi.fn();
    const user = userEvent.setup();
    const resource = mockResource();
    render(
      <ul>
        <ResourceListItem {...baseProps} resource={resource} onOpenEdit={onOpenEdit} />
      </ul>
    );
    await user.click(screen.getByRole("button", { name: "Edytuj" }));
    expect(onOpenEdit).toHaveBeenCalledWith(resource);
    expect(open).not.toHaveBeenCalled();
  });

  it("w trybie gęstym ukrywa opis i tagi", () => {
    render(
      <ul>
        <ResourceListItem {...baseProps} dense resource={mockResource()} onOpenEdit={vi.fn()} />
      </ul>
    );
    expect(screen.getByText("Example Title")).toBeInTheDocument();
    expect(screen.queryByText("Test description")).not.toBeInTheDocument();
    expect(screen.queryByText("tag1")).not.toBeInTheDocument();
  });

  it("pokazuje link notatka tylko gdy jest notePath i woła onOpenNote", async () => {
    const onOpenNote = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <ul>
        <ResourceListItem
          {...baseProps}
          resource={mockResource({ notePath: "Knowledge/a.md" })}
          onOpenEdit={vi.fn()}
          onOpenNote={onOpenNote}
        />
      </ul>
    );
    await user.click(screen.getByRole("button", { name: /notatka/i }));
    expect(onOpenNote).toHaveBeenCalledWith("Knowledge/a.md");

    rerender(
      <ul>
        <ResourceListItem
          {...baseProps}
          resource={mockResource()}
          onOpenEdit={vi.fn()}
          onOpenNote={onOpenNote}
        />
      </ul>
    );
    expect(screen.queryByRole("button", { name: /notatka/i })).not.toBeInTheDocument();
  });
});
