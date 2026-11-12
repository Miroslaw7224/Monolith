import React from "react";
import { cleanup, renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MindMap, MindMapNode } from "@/src/features/mind-maps/mindMapTypes";
import { useMindMapDocument } from "@/src/features/mind-maps/useMindMapDocument";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function root(label: string): MindMapNode {
  return { id: "root", label, note: "", collapsed: false, children: [] };
}

function mapOf(label: string): MindMap {
  return {
    id: "map-1",
    title: label,
    rootNode: root(label),
    colWidths: {},
    createdAt: null,
    updatedAt: null,
  };
}

describe("useMindMapDocument", () => {
  it("flushes a pending edit on unmount instead of dropping the timer", async () => {
    const apiFetch = vi.fn(async () => new Response(null, { status: 200 }));
    const onChanged = vi.fn();
    const { result, unmount } = renderHook(() =>
      useMindMapDocument({
        map: mapOf("Start"),
        apiFetch,
        onChanged,
        onRefreshList: async () => {},
      })
    );

    act(() => {
      result.current.updateTree((node) => ({ ...node, label: "Po zmianie" }), {
        kind: "structure",
      });
    });
    expect(apiFetch).not.toHaveBeenCalled();

    unmount();
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    const init = (apiFetch.mock.calls as unknown as [string, RequestInit][])[0]?.[1];
    expect(JSON.parse(String(init.body)).rootNode.label).toBe("Po zmianie");
    expect(init.keepalive).toBe(true);
  });

  it("debounces the save and surfaces a failed response", async () => {
    vi.useFakeTimers();
    const apiFetch = vi.fn(async () => new Response("no", { status: 500 }));
    const onChanged = vi.fn();
    const { result } = renderHook(() =>
      useMindMapDocument({
        map: mapOf("Start"),
        apiFetch,
        onChanged,
        onRefreshList: async () => {},
      })
    );

    act(() => {
      result.current.updateTree((node) => ({ ...node, label: "Nowa" }), { kind: "structure" });
    });
    expect(result.current.savePhase).toBe("pending");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(result.current.savePhase).toBe("error");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("undoes a structure edit back to the previous tree", () => {
    const apiFetch = vi.fn(async () => new Response(null, { status: 200 }));
    const { result } = renderHook(() =>
      useMindMapDocument({
        map: mapOf("Start"),
        apiFetch,
        onChanged: () => {},
        onRefreshList: async () => {},
      })
    );

    act(() => {
      result.current.updateTree((node) => ({ ...node, label: "Nowa" }), { kind: "structure" });
    });
    act(() => result.current.undo());
    expect(result.current.rootNode.label).toBe("Start");
    expect(result.current.canRedo).toBe(true);
  });
});
