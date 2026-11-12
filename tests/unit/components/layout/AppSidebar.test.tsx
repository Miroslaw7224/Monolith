import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AppSidebar } from "@/src/components/layout/AppSidebar";

const t = {
  title: "Monolith",
  subtitle: "Freelancer Edition",
  proPlan: "PRO",
  docsLimit: "Limit dokumentów",
};

describe("AppSidebar", () => {
  beforeEach(() => cleanup());

  it("renders title, panel content and the plan block", () => {
    render(
      <AppSidebar isSidebarOpen lang="pl" setLang={vi.fn()} documentsCount={10} t={t}>
        <p>Panel content</p>
      </AppSidebar>
    );

    expect(screen.getByRole("heading", { name: "Monolith" })).toBeInTheDocument();
    expect(screen.getByText("Panel content")).toBeInTheDocument();
    expect(screen.getByText("PRO")).toBeInTheDocument();
  });

  it("does not render a user card or a logout button", () => {
    render(
      <AppSidebar isSidebarOpen lang="pl" setLang={vi.fn()} documentsCount={0} t={t}>
        <span />
      </AppSidebar>
    );

    expect(screen.queryByText(/wyloguj|logout/i)).toBeNull();
  });
});
