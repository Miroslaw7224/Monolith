// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CONTEXT_PACK_ROLES } from "@/contexts/bc_projects/models";
import { ContextPackRoleSchema, PACK_ROLES } from "@/contexts/bc_projects/schemas";

describe("role paczki kontekstu", () => {
  it("lista z ContextPackRoleSchema zgodna z CONTEXT_PACK_ROLES w models", () => {
    expect([...ContextPackRoleSchema.options]).toEqual([...CONTEXT_PACK_ROLES]);
  });

  it("PACK_ROLES ma te same klucze w tej samej kolejności i niepuste etykiety", () => {
    expect(PACK_ROLES.map((r) => r.key)).toEqual([...CONTEXT_PACK_ROLES]);
    for (const r of PACK_ROLES) expect(r.label.length).toBeGreaterThan(0);
  });

  it("schemat przyjmuje role i odrzuca nieznaną", () => {
    expect(ContextPackRoleSchema.safeParse("review").success).toBe(true);
    expect(ContextPackRoleSchema.safeParse("zly").success).toBe(false);
  });
});
