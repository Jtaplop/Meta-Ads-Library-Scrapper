import { describe, it, expect } from "vitest";
import { scrapeFormSchema, batchFormSchema, parseBatchQueries } from "../schemas";

describe("scrapeFormSchema", () => {
  it("validates valid keyword scrape", () => {
    const res = scrapeFormSchema.safeParse({
      mode: "keyword",
      query: "psicologia",
      country: "es",
      status: "active",
      limit: "50",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.country).toBe("ES");
      expect(res.data.limit).toBe(50);
    }
  });

  it("fails if page_url does not start with http and contain facebook.com", () => {
    const res = scrapeFormSchema.safeParse({
      mode: "page_url",
      query: "https://google.com/test",
    });
    expect(res.success).toBe(false);
  });

  it("fails if slug contains slashes or spaces", () => {
    const res = scrapeFormSchema.safeParse({
      mode: "slug",
      query: "invalid slug with spaces",
    });
    expect(res.success).toBe(false);
  });
});

describe("batchFormSchema", () => {
  it("parses and deduplicates lines properly", () => {
    const raw = `
      keyword 1
      keyword 2

      keyword 1
      keyword 3
    `;
    const parsed = parseBatchQueries(raw);
    expect(parsed).toEqual(["keyword 1", "keyword 2", "keyword 3"]);
  });

  it("validates pause_seconds bounds", () => {
    const res = batchFormSchema.safeParse({
      queriesText: "dentistas\nmedicos",
      pause_seconds: 2000, // exceeds 1800
    });
    expect(res.success).toBe(false);
  });
});
