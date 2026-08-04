import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi, beforeEach, test, expect } from "vitest";
import HomeView from "@/src/features/home/HomeView";
import { translations } from "@/src/translations";

vi.mock("@/src/components/ActivityLog", () => ({
  ActivityLog: () => <div data-testid="activity-log" />,
}));
vi.mock("@/src/components/layout/AppSidebar", () => ({
  AppSidebar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar">{children}</div>
  ),
}));
vi.mock("@/src/components/layout/AppHeader", () => ({
  AppHeader: () => <div data-testid="header" />,
}));

const t = translations["pl"];

const mockApiFetch = vi.fn();

beforeEach(() => {
  mockApiFetch.mockResolvedValue({
    ok: true,
    json: async () => [],
  });
});

const defaultProps = {
  user: { id: "1", email: "test@test.com", name: "Test" },
  apiFetch: mockApiFetch,
  lang: "pl" as const,
  t,
  isSidebarOpen: true,
  setIsSidebarOpen: vi.fn(),
  appMode: "home" as const,
  setAppMode: vi.fn(),
  planningTab: "tasks" as const,
  setPlanningTab: vi.fn(),
  onLogout: vi.fn(),
  setLang: vi.fn(),
};

test("renders stats row with zero counts when no data", async () => {
  render(<HomeView {...defaultProps} />);
  await waitFor(() => {
    expect(screen.getAllByText(t.homeTodayTasks).length).toBeGreaterThan(0);
    expect(screen.getAllByText(t.homeUpcoming).length).toBeGreaterThan(0);
  });
});

test("renders today's tasks filtered by due_date", async () => {
  const today = new Date().toISOString().split("T")[0];
  mockApiFetch.mockImplementation((url: string) => {
    if (url.startsWith("/api/tasks")) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          { id: "1", title: "Wyślij fakturę", due_date: today, status: "todo" },
          { id: "2", title: "Stare zadanie", due_date: "2020-01-01", status: "todo" },
          { id: "3", title: "Gotowe", due_date: today, status: "done" },
        ],
      });
    }
    return Promise.resolve({ ok: true, json: async () => [] });
  });
  render(<HomeView {...defaultProps} />);
  await waitFor(() => {
    expect(screen.getByText("Wyślij fakturę")).toBeInTheDocument();
    expect(screen.queryByText("Stare zadanie")).not.toBeInTheDocument();
    expect(screen.queryByText("Gotowe")).not.toBeInTheDocument();
  });
});
