import type { AdRecord } from "@/api/types";

export type LandingType =
  | "instagram"
  | "whatsapp"
  | "calendly"
  | "facebook"
  | "linktree"
  | "web"
  | "none";

export interface EnrichedAd extends AdRecord {
  days_active: number | null;
  landing_type: LandingType;
  landing_domain: string | null;
  has_video: boolean;
  has_image: boolean;
  is_winner: boolean;
  advertiser_key: string;
  ads_count?: number;
}

/**
 * Classifies a URL into a LandingType according to SPEC-FRONTEND rules.
 */
export function classifyLandingType(url: string | null | undefined): LandingType {
  if (!url || typeof url !== "string") return "none";
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return "none";

  if (trimmed.includes("instagram.com/")) return "instagram";
  if (
    trimmed.includes("wa.me") ||
    trimmed.includes("api.whatsapp.com") ||
    trimmed.includes("whatsapp.com")
  ) {
    return "whatsapp";
  }
  if (trimmed.includes("calendly.com")) return "calendly";
  if (
    trimmed.includes("facebook.com") ||
    trimmed.includes("fb.me") ||
    trimmed.includes("m.me")
  ) {
    return "facebook";
  }
  if (trimmed.includes("linktr.ee") || trimmed.includes("beacons.ai")) {
    return "linktree";
  }

  // If it looks like a valid web URL or protocol
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.includes(".")) {
    return "web";
  }

  return "none";
}

/**
 * Extracts a clean domain name from a URL string.
 */
export function extractDomain(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    let raw = url.trim();
    if (!/^https?:\/\//i.test(raw)) {
      raw = `https://${raw}`;
    }
    const parsed = new URL(raw);
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

/**
 * Calculates days between start_date and (end_date ?? today).
 */
export function calculateDaysActive(
  startDateStr: string | null | undefined,
  endDateStr: string | null | undefined,
  referenceDate: Date = new Date()
): number | null {
  if (!startDateStr) return null;

  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return null;

  let end: Date;
  if (endDateStr) {
    end = new Date(endDateStr);
    if (isNaN(end.getTime())) {
      end = referenceDate;
    }
  } else {
    end = referenceDate;
  }

  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Enriches a single AdRecord with calculated fields.
 */
export function enrichAd(
  ad: AdRecord,
  winnerThreshold: number = 30,
  referenceDate: Date = new Date()
): EnrichedAd {
  const landingType = classifyLandingType(ad.landing_page);
  const landingDomain = extractDomain(ad.landing_page);
  const daysActive = calculateDaysActive(ad.start_date, ad.end_date, referenceDate);
  const hasVideo = Boolean(ad.video_url && ad.video_url.trim().length > 0);
  const hasImage = Boolean(ad.image_url && ad.image_url.trim().length > 0);

  const isStatusActive = (ad.status ?? "").toUpperCase() === "ACTIVE";
  const isWinner =
    isStatusActive && daysActive !== null && daysActive >= winnerThreshold;

  const advertiserKey =
    (ad.ig_username && ad.ig_username.trim()) ||
    (ad.page_id && ad.page_id.trim()) ||
    ad.ad_id;

  return {
    ...ad,
    days_active: daysActive,
    landing_type: landingType,
    landing_domain: landingDomain,
    has_video: hasVideo,
    has_image: hasImage,
    is_winner: isWinner,
    advertiser_key: advertiserKey,
  };
}

/**
 * Enriches an array of AdRecords.
 */
export function enrichAds(
  ads: AdRecord[],
  winnerThreshold: number = 30,
  referenceDate: Date = new Date()
): EnrichedAd[] {
  return ads.map((ad) => enrichAd(ad, winnerThreshold, referenceDate));
}

/**
 * Deduplicates ads by advertiser key (ig_username fallback page_id fallback ad_id).
 * Retains the ad with the oldest start_date and sets `ads_count` to total ads count for that advertiser.
 */
export function dedupeAds(ads: EnrichedAd[]): EnrichedAd[] {
  const groups = new Map<string, EnrichedAd[]>();

  for (const ad of ads) {
    const key = ad.advertiser_key;
    const existing = groups.get(key);
    if (existing) {
      existing.push(ad);
    } else {
      groups.set(key, [ad]);
    }
  }

  const deduped: EnrichedAd[] = [];

  for (const [, group] of groups) {
    // Sort ascending by start_date so index 0 is the oldest (earliest start)
    group.sort((a, b) => {
      if (!a.start_date && !b.start_date) return 0;
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return a.start_date.localeCompare(b.start_date);
    });

    const oldest = { ...group[0], ads_count: group.length };
    deduped.push(oldest);
  }

  return deduped;
}
