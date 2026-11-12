import React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetailDto, ProjectSummaryDto } from "@/contexts/bc_projects/schemas";
import { useProjects } from "@/src/features/projects/useProjects";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function summary(
  partial: Partial<ProjectSummaryDto> & Pick<ProjectSummaryDto, "id">
): ProjectSummaryDto {
  return {
    name: partial.id,
    status: "active",
    priority: "P2",
    localPath: `/tmp/${partial.id}`,
    owner: "personal",
    freshness: "fresh",
    ...partial,
  };
}

function detail(
  partial: Partial<ProjectDetailDto> & Pick<ProjectDetailDto, "id">
): ProjectDetailDto {
  return {
    ...summary(partial),
    tasks: [],
    bugs: [],
    whereIStopped: null,
    ...partial,
  };
}

describe("useProjects", () => {
  it("błąd", async () => {
    const apiFetch = vi.fn(async (url: string) => {
      if (url === "/api/projects") {
        return new Response(JSON.stringify({ error: "Brak NEXUS_VAULT_PATH" }), { status: 500 });
      }
      return new Response("{}", { status: 404 });
    });

    const { result } = renderHook(() => useProjects(apiFetch));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Brak NEXUS_VAULT_PATH");
  });

  it("domyślny wybór i przełączanie", async () => {
    const a = summary({ id: "a" });
    const b = summary({ id: "b" });
    const apiFetch = vi.fn(async (url: string) => {
      if (url === "/api/projects") {
        return new Response(JSON.stringify({ projects: [a, b], warnings: [] }), { status: 200 });
      }
      if (url === "/api/projects/a") {
        return new Response(JSON.stringify(detail({ id: "a", name: "A" })), { status: 200 });
      }
      if (url === "/api/projects/b") {
        return new Response(JSON.stringify(detail({ id: "b", name: "B" })), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });

    const { result } = renderHook(() => useProjects(apiFetch));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.selectedId).toBe("a");
    expect(apiFetch).toHaveBeenCalledWith("/api/projects");
    await waitFor(() =>
      expect(apiFetch.mock.calls.some((c) => c[0] === "/api/projects/a")).toBe(true)
    );

    act(() => {
      result.current.select("b");
    });
    await waitFor(() => expect(result.current.selectedId).toBe("b"));
    await waitFor(() =>
      expect(apiFetch.mock.calls.some((c) => c[0] === "/api/projects/b")).toBe(true)
    );
    await waitFor(() => expect(result.current.detail?.id).toBe("b"));
  });

  it("błąd szczegółów", async () => {
    const a = summary({ id: "a" });
    const apiFetch = vi.fn(async (url: string) => {
      if (url === "/api/projects") {
        return new Response(JSON.stringify({ projects: [a], warnings: [] }), { status: 200 });
      }
      if (url === "/api/projects/a") {
        return new Response(JSON.stringify({ error: "Nie ma projektu o id a" }), { status: 404 });
      }
      return new Response("{}", { status: 404 });
    });

    const { result } = renderHook(() => useProjects(apiFetch));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    await waitFor(() => expect(result.current.detailError).toBe("Nie ma projektu o id a"));
    expect(result.current.projects).toHaveLength(1);
    expect(result.current.detail).toBeNull();
  });

  it("nieaktualna odpowiedź", async () => {
    const a = summary({ id: "a" });
    const b = summary({ id: "b" });
    let resolveA!: (value: Response) => void;
    const aPromise = new Promise<Response>((resolve) => {
      resolveA = resolve;
    });

    const apiFetch = vi.fn(async (url: string) => {
      if (url === "/api/projects") {
        return new Response(JSON.stringify({ projects: [a, b], warnings: [] }), { status: 200 });
      }
      if (url === "/api/projects/a") {
        return aPromise;
      }
      if (url === "/api/projects/b") {
        return new Response(JSON.stringify(detail({ id: "b", name: "B" })), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });

    const { result } = renderHook(() => useProjects(apiFetch));

    await waitFor(() => expect(result.current.selectedId).toBe("a"));
    await waitFor(() =>
      expect(apiFetch.mock.calls.some((c) => c[0] === "/api/projects/a")).toBe(true)
    );

    act(() => {
      result.current.select("b");
    });
    await waitFor(() => expect(result.current.detail?.id).toBe("b"));

    await act(async () => {
      resolveA(new Response(JSON.stringify(detail({ id: "a", name: "A late" })), { status: 200 }));
    });

    expect(result.current.detail?.id).toBe("b");
  });

  it("odrzucony fetch listy kończy się błędem, nie wiecznym ładowaniem", async () => {
    const apiFetch = vi.fn(async () => {
      throw new Error("Failed to fetch");
    });
    const { result } = renderHook(() => useProjects(apiFetch));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Failed to fetch");
  });
});
