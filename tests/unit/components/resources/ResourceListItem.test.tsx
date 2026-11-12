import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResourceListItem } from "@/src/components/resources/ResourceListItem";
import type { NoteResource } from "@/src/components/resources/resourceTypes";

function mockResource(overrides?: Partial<NoteResource>): NoteResource {
  return {
    id: "res-1",
    userId: "user-1",
    description: "Test description",
    url: "https://example.com",
    title: "Example Title",
    tags: ["tag1", "tag2"],
    isFavorite: false,
    ...overrides,
  };
}

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

    const deleteButton = within(container).getByRole("button", { name: /delete/i });
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

    const copyButton = within(container).getByRole("button", { name: /copy url/i });
    await user.click(copyButton);

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledWith("https://copy-me.com");
  });
});
