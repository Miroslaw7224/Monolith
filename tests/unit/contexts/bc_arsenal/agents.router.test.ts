// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

const svc = vi.hoisted(() => ({
  listAgents: vi.fn(),
  createAgentEntry: vi.fn(),
  updateAgentEntry: vi.fn(),
  removeAgentEntry: vi.fn(),
}));
vi.mock("@/contexts/bc_arsenal/services", () => svc);

import {
  deleteAgentEntry,
  getAgents,
  postAgentEntry,
  putAgentEntry,
} from "@/contexts/bc_arsenal/router";

const preset = { kind: "preset" as const, id: "p1", name: "P", command: "cmd" };
const ctx = { params: Promise.resolve({ entryId: "p1" }) };
const req = (body: unknown, method = "POST") =>
  new Request("http://localhost/api/arsenal/agents", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const valid = { kind: "preset", name: " P ", command: "cmd" };

beforeEach(() => Object.values(svc).forEach((fn) => fn.mockReset()));

describe("getAgents", () => {
  it("200 z DTO", async () => {
    svc.listAgents.mockReturnValue({ agents: [], presets: [preset], scripts: [], skipped: 1 });
    const res = await getAgents();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ agents: [], presets: [preset], scripts: [], skipped: 1 });
  });

  it("błąd domenowy zachowuje status", async () => {
    svc.listAgents.mockImplementation(() => {
      throw new DomainError("źle", 409);
    });
    expect((await getAgents()).status).toBe(409);
  });
});

describe("postAgentEntry", () => {
  it("201 i przycięte dane do serwisu", async () => {
    svc.createAgentEntry.mockResolvedValue(preset);
    const res = await postAgentEntry(req(valid));
    expect(res.status).toBe(201);
    expect(svc.createAgentEntry).toHaveBeenCalledWith(expect.objectContaining({ name: "P" }));
  });

  it("400 dla nieznanego rodzaju i braku pola głównego", async () => {
    expect((await postAgentEntry(req({ kind: "x", name: "N" }))).status).toBe(400);
    expect((await postAgentEntry(req({ kind: "preset", name: "N" }))).status).toBe(400);
    expect(svc.createAgentEntry).not.toHaveBeenCalled();
  });
});

describe("putAgentEntry", () => {
  it("200 z DTO", async () => {
    svc.updateAgentEntry.mockResolvedValue(preset);
    const res = await putAgentEntry(req(valid, "PUT"), ctx);
    expect(res.status).toBe(200);
    expect(svc.updateAgentEntry).toHaveBeenCalledWith("p1", expect.objectContaining({ name: "P" }));
  });

  it("404 gdy serwis zgłasza brak wpisu", async () => {
    svc.updateAgentEntry.mockRejectedValue(new DomainError("Wpis nie istnieje", 404));
    expect((await putAgentEntry(req(valid, "PUT"), ctx)).status).toBe(404);
  });
});

describe("deleteAgentEntry", () => {
  it("204", async () => {
    svc.removeAgentEntry.mockResolvedValue(undefined);
    const res = await deleteAgentEntry(
      new Request("http://localhost/x", { method: "DELETE" }),
      ctx
    );
    expect(res.status).toBe(204);
    expect(svc.removeAgentEntry).toHaveBeenCalledWith("p1");
  });
});
