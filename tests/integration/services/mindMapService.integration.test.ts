import { describe, it, expect } from "vitest";
import { DomainError } from "../../../lib/errors.js";
import { createMindMap, getMindMap, deleteMindMap } from "../../../services/mindMapService.js";

const runIntegration = !!process.env.RUN_INTEGRATION_TESTS;

describe("mindMapService (integration)", () => {
  it.skipIf(!runIntegration)(
    "when Firestore is available, create get and delete a mind map",
    async () => {
      const title = `e2e-map-${Date.now()}`;
      const created = await createMindMap(title);
      expect(created.id).toBeTruthy();
      expect(created.title).toBe(title);

      const loaded = await getMindMap(created.id);
      expect(loaded.rootNode.label).toBe(title);

      await deleteMindMap(created.id);
      await expect(getMindMap(created.id)).rejects.toThrow(DomainError);
    }
  );
});
