import { describe, it, expect } from "vitest";
import { exportAdsToCsv, exportAdsToJson } from "../exportCsv";
import type { AdRecord } from "@/api/types";

describe("exportAdsToCsv", () => {
  const ads: AdRecord[] = [
    {
      ad_id: "1234567890123456",
      page_id: "98765",
      page_name: 'Brand, "Special" Edition',
      ad_text: "Line 1\nLine 2",
      ad_caption: "Caption",
      start_date: "2026-01-01",
      end_date: null,
      status: "ACTIVE",
      image_url: "https://example.com/a.jpg",
      video_url: null,
      landing_page: "https://example.com",
      snapshot_url: null,
      ig_username: "brand_special",
      platforms: ["FACEBOOK", "INSTAGRAM"],
    },
  ];

  it("exports CSV starting with UTF-8 BOM", () => {
    const csv = exportAdsToCsv(ads, "test.csv");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("ad_id,page_id,page_name");
    // Escaping check for quotes and commas
    expect(csv).toContain('"Brand, ""Special"" Edition"');
    expect(csv).toContain('"FACEBOOK, INSTAGRAM"');
  });

  it("exports JSON formatted correctly", () => {
    const json = exportAdsToJson(ads, "test.json");
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].ad_id).toBe("1234567890123456");
  });
});
