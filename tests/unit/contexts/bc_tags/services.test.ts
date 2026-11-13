import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getUserTags,
  createUserTag,
  updateUserTag,
  deleteUserTag,
} from "@/contexts/bc_tags/services";

const mockGetUserTags = vi.hoisted(() => vi.fn());
const mockCreateUserTag = vi.hoisted(() => vi.fn());
const mockUpdateUserTag = vi.hoisted(() => vi.fn());
const mockDeleteUserTag = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_tags/repositories", () => ({
  getUserTags: (...args: unknown[]) => mockGetUserTags(...args),
  createUserTag: (...args: unknown[]) => mockCreateUserTag(...args),
  updateUserTag: (...args: unknown[]) => mockUpdateUserTag(...args),
  deleteUserTag: (...args: unknown[]) => mockDeleteUserTag(...args),
}));

describe("bc_tags services", () => {
  beforeEach(() => {
    mockGetUserTags.mockReset();
    mockCreateUserTag.mockReset();
    mockUpdateUserTag.mockReset();
    mockDeleteUserTag.mockReset();
  });

  describe("getUserTags", () => {
    it("given Firestore returns tags, when getUserTags is called, then returns the list (happy path)", async () => {
      const tags = [{ id: "tag1", tag: "work", title: "Work" }];
      mockGetUserTags.mockResolvedValue(tags);

      const result = await getUserTags();

      expect(result).toEqual(tags);
    });

    it("given getUserTags throws, when getUserTags is called, then propagates the error", async () => {
      mockGetUserTags.mockRejectedValue(new Error("DB error"));

      await expect(getUserTags()).rejects.toThrow("DB error");
    });
  });

  describe("createUserTag", () => {
    it("given valid data, when createUserTag is called, then returns created tag (happy path)", async () => {
      mockCreateUserTag.mockResolvedValue({ id: "tag1", tag: "work", title: "Work" });

      const result = await createUserTag({ tag: "work", title: "Work" });

      expect(result).toEqual({ id: "tag1", tag: "work", title: "Work" });
    });

    it("given createUserTag throws, when createUserTag is called, then propagates the error", async () => {
      mockCreateUserTag.mockRejectedValue(new Error("Create failed"));

      await expect(createUserTag({ tag: "x", title: "y" })).rejects.toThrow("Create failed");
    });

    it("given data with color, when createUserTag is called, then passes color to firestore", async () => {
      mockCreateUserTag.mockResolvedValue({
        id: "tag1",
        tag: "work",
        title: "Work",
        color: "#FF0000",
      });

      await createUserTag({ tag: "work", title: "Work", color: "#FF0000" });

      expect(mockCreateUserTag).toHaveBeenCalledWith({
        tag: "work",
        title: "Work",
        color: "#FF0000",
      });
    });
  });

  describe("updateUserTag", () => {
    it("given valid id and data, when updateUserTag is called, then delegates to firestore (happy path)", async () => {
      mockUpdateUserTag.mockResolvedValue(undefined);

      await updateUserTag("tag1", { title: "New Title" });

      expect(mockUpdateUserTag).toHaveBeenCalledWith("tag1", { title: "New Title" });
    });

    it("given updateUserTag throws, when updateUserTag is called, then propagates the error", async () => {
      mockUpdateUserTag.mockRejectedValue(new Error("Update failed"));

      await expect(updateUserTag("tag1", { tag: "x" })).rejects.toThrow("Update failed");
    });

    it("given data with color, when updateUserTag is called, then passes color to firestore", async () => {
      mockUpdateUserTag.mockResolvedValue(undefined);

      await updateUserTag("tag1", { color: "#00FF00" });

      expect(mockUpdateUserTag).toHaveBeenCalledWith("tag1", { color: "#00FF00" });
    });

    it("given color null, when updateUserTag is called, then passes color null to firestore", async () => {
      mockUpdateUserTag.mockResolvedValue(undefined);

      await updateUserTag("tag1", { color: null });

      expect(mockUpdateUserTag).toHaveBeenCalledWith("tag1", { color: null });
    });
  });

  describe("deleteUserTag", () => {
    it("given valid id, when deleteUserTag is called, then delegates to firestore (happy path)", async () => {
      mockDeleteUserTag.mockResolvedValue(undefined);

      await deleteUserTag("tag1");

      expect(mockDeleteUserTag).toHaveBeenCalledWith("tag1");
    });

    it("given deleteUserTag throws, when deleteUserTag is called, then propagates the error", async () => {
      mockDeleteUserTag.mockRejectedValue(new Error("Delete failed"));

      await expect(deleteUserTag("tag1")).rejects.toThrow("Delete failed");
    });
  });
});
