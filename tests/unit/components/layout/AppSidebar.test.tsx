import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AppSidebar } from "@/src/components/layout/AppSidebar";

const t = {
  title: "Monolith",
  subtitle: "Offline Nexus Core",
};

describe("AppSidebar", () => {
  beforeEach(() => cleanup());

  it("renders title and panel content", () => {
    render(
      <AppSidebar isSidebarOpen lang="pl" setLang={vi.fn()} t={t}>
        <p>Panel content</p>
      </AppSidebar>
    );

    expect(screen.getByRole("heading", { name: "Monolith" })).toBeInTheDocument();
    expect(screen.getByText("Panel content")).toBeInTheDocument();
  });

  it("does not render a plan or document limit block", () => {
    const { container } = render(
      <AppSidebar isSidebarOpen lang="pl" setLang={vi.fn()} t={t}>
        <span />
      </AppSidebar>
    );

    expect(container.querySelector(".h-1\\.5")).toBeNull();
  });

  it("does not render a user card or a logout button", () => {
    render(
      <AppSidebar isSidebarOpen lang="pl" setLang={vi.fn()} t={t}>
        <span />
      </AppSidebar>
    );

    expect(screen.queryByText(/wyloguj|logout/i)).toBeNull();
  });
});
