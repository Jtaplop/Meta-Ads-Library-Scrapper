import { describe, it, expect } from "vitest";
import { buildCliPreview } from "../cliPreview";
import type { ScrapeRequest } from "@/api/types";

describe("cliPreview", () => {
  it("builds correct command with keyword mode", () => {
    const req: ScrapeRequest = {
      mode: "keyword",
      query: "psicologia clinica",
      country: "ES",
      status: "active",
      platform: "instagram",
      media_type: "video",
      min_date: "2025-11-01",
      exact: true,
      only_ig_profile: true,
      format: "csv",
      limit: 100,
    };

    const cmd = buildCliPreview(req);
    expect(cmd).toBe(
      'python main.py --keyword "psicologia clinica" --country ES --status active --platform instagram --media video --min-date 2025-11-01 --exact --only-ig-profile --format csv --limit 100'
    );
  });

  it("builds correct command with slug mode and default values", () => {
    const req: Partial<ScrapeRequest> = {
      mode: "slug",
      query: "nike",
    };

    const cmd = buildCliPreview(req);
    expect(cmd).toBe(
      "python main.py --slug nike --country ALL --status active --media all --format csv --limit 50"
    );
  });

  it("builds correct command with page_url mode", () => {
    const req: Partial<ScrapeRequest> = {
      mode: "page_url",
      query: "https://www.facebook.com/nike",
      format: "json",
      limit: 25,
    };

    const cmd = buildCliPreview(req);
    expect(cmd).toBe(
      "python main.py --page-url https://www.facebook.com/nike --country ALL --status active --media all --format json --limit 25"
    );
  });
});
