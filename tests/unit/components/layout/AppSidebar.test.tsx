import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppSidebar } from "@/src/components/layout/AppSidebar";

const t = {
  title: "Nexus",
  subtitle: "Freelancer Edition",
  logout: "Wyloguj",
  proPlan: "PRO",
  docsLimit: "Limit dokumentów",
};

describe("AppSidebar", () => {
  beforeEach(() => cleanup());

  it("renders title, user and logout control", () => {
    const onLogout = vi.fn();
    render(
      <AppSidebar
        isSidebarOpen
        lang="pl"
        setLang={vi.fn()}
        user={{ id: "1", email: "u@test.com", name: "Jan K" }}
        onLogout={onLogout}
        documentsCount={10}
        t={t}
      >
        <p>Panel content</p>
      </AppSidebar>
    );

    expect(screen.getByRole("heading", { name: "Nexus" })).toBeInTheDocument();
    expect(screen.getByText("Jan K")).toBeInTheDocument();
    expect(screen.getByText("Panel content")).toBeInTheDocument();
  });

  it("invokes onLogout when logout is clicked", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(
      <AppSidebar
        isSidebarOpen
        lang="pl"
        setLang={vi.fn()}
        user={{ id: "1", email: "only@mail.com", name: "" }}
        onLogout={onLogout}
        documentsCount={0}
        t={t}
      >
        <span />
      </AppSidebar>
    );

    await user.click(screen.getByRole("button", { name: "Wyloguj" }));
    expect(onLogout).toHaveBeenCalled();
  });
});
