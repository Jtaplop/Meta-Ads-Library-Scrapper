import type { AdRecord } from "@/api/types";
import type { EnrichedAd } from "./enrich";

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = Array.isArray(val) ? val.join(", ") : String(val);

  // If cell contains comma, quote, or newline, escape quotes and wrap in quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts an array of AdRecord or EnrichedAd to CSV format with UTF-8 BOM.
 * Also initiates a browser download if in a browser environment with URL.createObjectURL support.
 */
export function exportAdsToCsv(
  ads: (AdRecord | EnrichedAd)[],
  filename: string = "ads_export.csv"
): string {
  const headers = [
    "ad_id",
    "page_id",
    "page_name",
    "ad_text",
    "ad_caption",
    "start_date",
    "end_date",
    "status",
    "landing_page",
    "image_url",
    "video_url",
    "snapshot_url",
    "ig_username",
    "platforms",
    "days_active",
    "landing_type",
    "is_winner",
    "ads_count",
  ];

  const lines: string[] = [headers.join(",")];

  for (const ad of ads) {
    const enriched = ad as Partial<EnrichedAd>;
    const row = [
      escapeCsvCell(ad.ad_id),
      escapeCsvCell(ad.page_id),
      escapeCsvCell(ad.page_name),
      escapeCsvCell(ad.ad_text),
      escapeCsvCell(ad.ad_caption),
      escapeCsvCell(ad.start_date),
      escapeCsvCell(ad.end_date),
      escapeCsvCell(ad.status),
      escapeCsvCell(ad.landing_page),
      escapeCsvCell(ad.image_url),
      escapeCsvCell(ad.video_url),
      escapeCsvCell(ad.snapshot_url),
      escapeCsvCell(ad.ig_username),
      escapeCsvCell(ad.platforms),
      escapeCsvCell(enriched.days_active),
      escapeCsvCell(enriched.landing_type),
      escapeCsvCell(enriched.is_winner),
      escapeCsvCell(enriched.ads_count),
    ];
    lines.push(row.join(","));
  }

  const csvBody = lines.join("\r\n");
  const fullContentWithBom = "\uFEFF" + csvBody;

  // Trigger download if running in DOM environment with createObjectURL available
  if (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof URL.createObjectURL === "function"
  ) {
    const blob = new Blob([fullContentWithBom], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(url);
    }
  }

  return fullContentWithBom;
}

/**
 * Converts an array of AdRecord or EnrichedAd to formatted JSON and triggers browser download.
 */
export function exportAdsToJson(
  ads: (AdRecord | EnrichedAd)[],
  filename: string = "ads_export.json"
): string {
  const jsonContent = JSON.stringify(ads, null, 2);

  if (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof URL.createObjectURL === "function"
  ) {
    const blob = new Blob([jsonContent], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename.endsWith(".json") ? filename : `${filename}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(url);
    }
  }

  return jsonContent;
}
