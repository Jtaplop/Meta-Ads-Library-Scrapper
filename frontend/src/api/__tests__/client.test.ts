import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch, ApiError } from "../client";

describe("apiFetch and ApiError", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("successfully parses JSON responses", async () => {
    const mockData = { status: "ok", version: "1.0.0" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => mockData,
      })
    );

    const res = await apiFetch<typeof mockData>("/api/health");
    expect(res).toEqual(mockData);
  });

  it("handles 204 No Content returning undefined", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
      })
    );

    const res = await apiFetch<void>("/api/jobs/123", { method: "DELETE" });
    expect(res).toBeUndefined();
  });

  it("throws ApiError on HTTP error with string detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ detail: "Job not found", code: "job_not_found" }),
      })
    );

    await expect(apiFetch("/api/jobs/999")).rejects.toThrow("Job not found");
    try {
      await apiFetch("/api/jobs/999");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.detail).toBe("Job not found");
      expect(apiErr.code).toBe("job_not_found");
    }
  });

  it("handles FastAPI validation error arrays in detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          detail: [
            { loc: ["body", "limit"], msg: "Input should be greater than 0" },
          ],
        }),
      })
    );

    try {
      await apiFetch("/api/jobs", { method: "POST" });
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(422);
      expect(apiErr.detail).toContain("Input should be greater than 0");
    }
  });
});
