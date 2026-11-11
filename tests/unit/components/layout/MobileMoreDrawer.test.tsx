import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, test, expect, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { MobileMoreDrawer } from "@/src/components/layout/MobileMoreDrawer";

vi.mock("motion/react", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeEach(() => cleanup());

test("renders logout button when open", () => {
  render(
    <MobileMoreDrawer
      isOpen={true}
      onClose={vi.fn()}
      onLogout={vi.fn()}
      lang="pl"
      onSelectTab={vi.fn()}
    />
  );
  expect(screen.getByText("Wyloguj")).toBeInTheDocument();
});

test("calls onClose when backdrop clicked", () => {
  const onClose = vi.fn();
  render(
    <MobileMoreDrawer
      isOpen={true}
      onClose={onClose}
      onLogout={vi.fn()}
      lang="pl"
      onSelectTab={vi.fn()}
    />
  );
  fireEvent.click(screen.getByTestId("drawer-backdrop"));
  expect(onClose).toHaveBeenCalled();
});

test("does not render content when closed", () => {
  render(
    <MobileMoreDrawer
      isOpen={false}
      onClose={vi.fn()}
      onLogout={vi.fn()}
      lang="pl"
      onSelectTab={vi.fn()}
    />
  );
  expect(screen.queryByText("Wyloguj")).not.toBeInTheDocument();
});

test("calls onSelectTab for resources", () => {
  const onSelectTab = vi.fn();
  render(
    <MobileMoreDrawer
      isOpen={true}
      onClose={vi.fn()}
      onLogout={vi.fn()}
      lang="pl"
      onSelectTab={onSelectTab}
    />
  );
  fireEvent.click(screen.getByText("Zasoby"));
  expect(onSelectTab).toHaveBeenCalledWith("resources");
});

test("calls onSelectTab for the board", () => {
  const onSelectTab = vi.fn();
  render(
    <MobileMoreDrawer
      isOpen={true}
      onClose={vi.fn()}
      onLogout={vi.fn()}
      lang="pl"
      onSelectTab={onSelectTab}
    />
  );
  fireEvent.click(screen.getByText("Tablica"));
  expect(onSelectTab).toHaveBeenCalledWith("board");
});
