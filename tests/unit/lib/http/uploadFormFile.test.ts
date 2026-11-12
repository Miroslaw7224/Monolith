/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import { parseUploadFormFile } from "@/lib/http/uploadFormFile";

describe("lib/uploadFormFile", () => {
  it("returns 400 when file missing or not File", async () => {
    const fd = new FormData();
    const r = await parseUploadFormFile(fd);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.response.status).toBe(400);

    fd.set("file", "string-not-file");
    const r2 = await parseUploadFormFile(fd);
    expect(r2.ok).toBe(false);
  });

  it("returns name type content for valid file", async () => {
    const fd = new FormData();
    fd.set("file", new File(["hello"], "doc.txt", { type: "text/plain" }));
    const r = await parseUploadFormFile(fd);
    expect(r).toEqual({
      ok: true,
      name: "doc.txt",
      type: "text/plain",
      content: "hello",
    });
  });
});
