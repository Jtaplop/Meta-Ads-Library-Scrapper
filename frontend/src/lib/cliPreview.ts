import type { ScrapeRequest } from "@/api/types";

function quoteIfNeeded(val: string | number): string {
  const str = String(val);
  if (str.length === 0) return '""';
  if (str.includes(" ") || str.includes('"') || str.includes("'") || str.includes("&") || str.includes("|")) {
    return `"${str.replace(/"/g, '\\"')}"`;
  }
  return str;
}

/**
 * Builds the equivalent Python CLI command string for a given ScrapeRequest.
 * Matches backend/main.py flags and options.
 */
export function buildCliPreview(req: Partial<ScrapeRequest>): string {
  const parts: string[] = ["python", "main.py"];

  // Search mode & query
  const mode = req.mode ?? "keyword";
  const query = req.query?.trim() ?? "";

  const modeFlag =
    mode === "page_url" ? "--page-url" : mode === "slug" ? "--slug" : "--keyword";

  if (query) {
    parts.push(modeFlag, quoteIfNeeded(query));
  } else {
    parts.push(modeFlag, quoteIfNeeded("<búsqueda>"));
  }

  // Country (defaults to ALL)
  const country = (req.country ?? "ALL").toUpperCase();
  parts.push("--country", quoteIfNeeded(country));

  // Status (defaults to active)
  const status = req.status ?? "active";
  parts.push("--status", status);

  // Platform (optional)
  if (req.platform) {
    parts.push("--platform", req.platform);
  }

  // Media type (defaults to all)
  const media = req.media_type ?? "all";
  parts.push("--media", media);

  // Min date (optional)
  if (req.min_date) {
    parts.push("--min-date", req.min_date);
  }

  // Exact phrase match (only applicable to keyword mode)
  if (req.exact && mode === "keyword") {
    parts.push("--exact");
  }

  // Only IG profile
  if (req.only_ig_profile) {
    parts.push("--only-ig-profile");
  }

  // Format (defaults to csv)
  const format = req.format ?? "csv";
  parts.push("--format", format);

  // Limit (defaults to 50)
  const limit = req.limit ?? 50;
  parts.push("--limit", limit.toString());

  return parts.join(" ");
}
