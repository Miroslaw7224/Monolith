import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockIngestDocument = vi.hoisted(() => vi.fn());
const mockParseUploadFormFile = vi.hoisted(() => vi.fn());

vi.mock("@/services/documentService", () => ({ ingestDocument: mockIngestDocument }));
vi.mock("@/lib/http/uploadFormFile", () => ({ parseUploadFormFile: mockParseUploadFormFile }));

import { POST } from "@/app/api/upload/route";

/**
 * Build a NextRequest whose formData() succeeds (returns an empty FormData).
 * We stub formData() directly because the jsdom test environment cannot parse
 * a multipart body serialised by the FormData constructor.
 */
function makeRequest(overrides: { formDataThrows?: boolean } = {}): NextRequest {
  const req = new NextRequest("http://localhost/api/upload", {
    method: "POST",
    // Content-type must be multipart for NextRequest to attempt formData parsing,
    // but we stub the method below so the body doesn't matter.
    body: "stub",
  });

  if (overrides.formDataThrows) {
    // Simulate a body that cannot be parsed as form data
    vi.spyOn(req, "formData").mockRejectedValue(new Error("invalid form data"));
  } else {
    vi.spyOn(req, "formData").mockResolvedValue(new FormData());
  }

  return req;
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when formData() throws (invalid form data)", async () => {
    const res = await POST(makeRequest({ formDataThrows: true }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid form data");
    expect(mockParseUploadFormFile).not.toHaveBeenCalled();
  });

  it("returns 400 when parseUploadFormFile signals failure (no file)", async () => {
    mockParseUploadFormFile.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "No file uploaded" }, { status: 400 }),
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No file uploaded");
  });

  it("ingests document and returns 200 with result on success", async () => {
    const result = { id: "doc-1", title: "test.txt" };
    mockParseUploadFormFile.mockResolvedValue({
      ok: true,
      name: "test.txt",
      type: "text/plain",
      content: "Hello world",
    });
    mockIngestDocument.mockResolvedValue(result);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("doc-1");
    expect(mockIngestDocument).toHaveBeenCalledWith({
      name: "test.txt",
      type: "text/plain",
      content: "Hello world",
    });
  });

  it("returns 500 when ingestDocument throws an unexpected error", async () => {
    mockParseUploadFormFile.mockResolvedValue({
      ok: true,
      name: "test.txt",
      type: "text/plain",
      content: "data",
    });
    mockIngestDocument.mockRejectedValue(new Error("DB failure"));

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
