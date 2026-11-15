import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useCourses } from "@/src/features/arsenal/useCourses";

const list = {
  courses: [
    {
      id: "c1",
      title: "Kurs",
      url: "https://a.example.com",
      status: "plan",
      certificateMissing: false,
    },
  ],
  skipped: 1,
};
const json = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as Response;

function setup(handler?: (url: string, init?: RequestInit) => Response) {
  const apiFetch = vi.fn(async (url: string, init?: RequestInit) =>
    handler ? handler(url, init) : json(list)
  );
  return { apiFetch, ...renderHook(() => useCourses(apiFetch)) };
}

const input = { title: "Nowy", url: "https://n.example.com", status: "plan" as const };

describe("useCourses", () => {
  it("ładuje listę i licznik pominiętych", async () => {
    const { result, apiFetch } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiFetch).toHaveBeenCalledWith("/api/arsenal/courses");
    expect(result.current.courses.map((c) => c.id)).toEqual(["c1"]);
    expect(result.current.skipped).toBe(1);
  });

  it("błąd ładowania trafia do `error`", async () => {
    const { result } = setup(() => json({ error: "Zepsute" }, false, 500));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Zepsute");
  });

  it("save bez id robi POST, z id robi PUT, potem odświeża listę", async () => {
    const { result, apiFetch } = setup((_url, init) => json(init?.method ? {} : list));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.save(input));
    const post = apiFetch.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(post[0]).toBe("/api/arsenal/courses");
    expect(JSON.parse(post[1]!.body as string)).toEqual(input);
    await act(() => result.current.save(input, "c1"));
    expect(
      apiFetch.mock.calls.some(
        ([url, init]) => url === "/api/arsenal/courses/c1" && init?.method === "PUT"
      )
    ).toBe(true);
    expect(apiFetch.mock.calls.filter(([, init]) => init === undefined)).toHaveLength(3);
  });

  it("save przy błędzie serwera rzuca z komunikatem serwera", async () => {
    const { result } = setup((_url, init) =>
      init?.method === "POST" ? json({ error: "Zły adres" }, false, 400) : json(list)
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(act(() => result.current.save(input))).rejects.toThrow("Zły adres");
  });

  it("remove robi DELETE i odświeża listę", async () => {
    const { result, apiFetch } = setup((_url, init) =>
      init?.method === "DELETE" ? ({ ok: true, status: 204 } as Response) : json(list)
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.remove("c1"));
    expect(
      apiFetch.mock.calls.some(
        ([url, init]) => url === "/api/arsenal/courses/c1" && init?.method === "DELETE"
      )
    ).toBe(true);
  });

  it("save pokazuje pierwszy komunikat walidacji pola z odpowiedzi 400", async () => {
    const { result } = setup((_url, init) =>
      init?.method === "POST"
        ? json(
            {
              error: "Validation failed",
              details: {
                certificateFile: ["certificateFile must be a relative path inside Documents/"],
              },
            },
            false,
            400
          )
        : json(list)
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(act(() => result.current.save(input))).rejects.toThrow(
      "Validation failed: certificateFile must be a relative path inside Documents/"
    );
  });

  it("zapis się udał, a odświeżenie padło: save nie rzuca (formularz się zamknie, brak duplikatu)", async () => {
    let posted = false;
    const { result } = setup((_url, init) => {
      if (init?.method === "POST") {
        posted = true;
        return json({});
      }
      return posted ? json({ error: "Odświeżenie padło" }, false, 500) : json(list);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.save(input));
    expect(result.current.error).toBe("Odświeżenie padło");
  });
});
