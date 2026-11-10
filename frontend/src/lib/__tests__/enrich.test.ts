import { describe, it, expect } from "vitest";
import {
  classifyLandingType,
  calculateDaysActive,
  enrichAd,
  enrichAds,
  dedupeAds,
} from "../enrich";
import type { AdRecord } from "@/api/types";

describe("classifyLandingType", () => {
  it("classifies instagram correctly", () => {
    expect(classifyLandingType("https://www.instagram.com/cliniclesalpes")).toBe("instagram");
  });

  it("classifies whatsapp correctly", () => {
    expect(classifyLandingType("https://wa.me/34600000000")).toBe("whatsapp");
    expect(classifyLandingType("https://api.whatsapp.com/send?phone=34123456789")).toBe("whatsapp");
  });

  it("classifies calendly correctly", () => {
    expect(classifyLandingType("https://calendly.com/demo/session")).toBe("calendly");
  });

  it("classifies facebook correctly", () => {
    expect(classifyLandingType("https://www.facebook.com/example")).toBe("facebook");
    expect(classifyLandingType("https://fb.me/page")).toBe("facebook");
    expect(classifyLandingType("https://m.me/username")).toBe("facebook");
  });

  it("classifies linktree correctly", () => {
    expect(classifyLandingType("https://linktr.ee/mybrand")).toBe("linktree");
    expect(classifyLandingType("https://beacons.ai/mybrand")).toBe("linktree");
  });

  it("classifies standard web correctly", () => {
    expect(classifyLandingType("https://example.com/landing")).toBe("web");
  });

  it("classifies empty/null as none", () => {
    expect(classifyLandingType("")).toBe("none");
    expect(classifyLandingType(null)).toBe("none");
    expect(classifyLandingType(undefined)).toBe("none");
  });
});

describe("calculateDaysActive", () => {
  it("calculates difference with endDate", () => {
    const days = calculateDaysActive("2026-01-01", "2026-01-11");
    expect(days).toBe(10);
  });

  it("calculates difference with referenceDate when endDate is absent", () => {
    const ref = new Date("2026-01-31T00:00:00Z");
    const days = calculateDaysActive("2026-01-01", null, ref);
    expect(days).toBe(30);
  });

  it("returns null for missing startDate", () => {
    expect(calculateDaysActive(null, null)).toBeNull();
  });
});

describe("enrichAd and dedupeAds", () => {
  const mockAds: AdRecord[] = [
    {
      ad_id: "1001",
      page_id: "p1",
      page_name: "Page One",
      ad_text: "Promo",
      ad_caption: null,
      start_date: "2026-01-15",
      end_date: null,
      status: "ACTIVE",
      image_url: "https://example.com/img.jpg",
      video_url: null,
      landing_page: "https://instagram.com/brand_one",
      snapshot_url: null,
      ig_username: "brand_one",
      platforms: ["INSTAGRAM"],
    },
    {
      ad_id: "1002",
      page_id: "p1",
      page_name: "Page One",
      ad_text: "Earlier promo",
      ad_caption: null,
      start_date: "2026-01-01",
      end_date: null,
      status: "ACTIVE",
      image_url: null,
      video_url: "https://example.com/vid.mp4",
      landing_page: "https://instagram.com/brand_one",
      snapshot_url: null,
      ig_username: "brand_one",
      platforms: ["FACEBOOK", "INSTAGRAM"],
    },
  ];

  it("enriches single ad", () => {
    const enrichedSingle = enrichAd(mockAds[0]);
    expect(enrichedSingle.ad_id).toBe("1001");
    expect(enrichedSingle.advertiser_key).toBe("brand_one");
  });

  it("correctly enriches ad and identifies winner", () => {
    const ref = new Date("2026-02-05T00:00:00Z"); // 35 days from 2026-01-01
    const enriched = enrichAds(mockAds, 30, ref);

    expect(enriched[0].landing_type).toBe("instagram");
    expect(enriched[0].has_image).toBe(true);
    expect(enriched[0].has_video).toBe(false);

    expect(enriched[1].is_winner).toBe(true); // 35 days active >= 30
  });

  it("deduplicates ads by advertiser_key preserving the oldest start_date", () => {
    const enriched = enrichAds(mockAds);
    const deduped = dedupeAds(enriched);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].ad_id).toBe("1002"); // The one from 2026-01-01
    expect(deduped[0].ads_count).toBe(2);
  });
});
