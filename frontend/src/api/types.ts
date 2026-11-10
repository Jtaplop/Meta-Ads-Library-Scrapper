/**
 * API and Domain Types for Meta Ads Scraper
 * Mirrors backend/api/schemas.py and SPEC-API.md
 */

export type SearchMode = "keyword" | "page_url" | "slug";

export type AdStatus = "active" | "inactive" | "all";
export type PlatformType = "instagram" | "facebook" | "messenger" | "audience_network";
export type MediaType = "all" | "video" | "image" | "memes" | "none";
export type ExportFormat = "csv" | "json";

export interface ScrapeRequest {
  mode: SearchMode;
  query: string;
  country?: string;
  status?: AdStatus;
  platform?: PlatformType | null;
  media_type?: MediaType;
  min_date?: string | null;
  exact?: boolean;
  only_ig_profile?: boolean;
  format?: ExportFormat;
  limit?: number;
}

export type JobStatus =
  | "queued"
  | "waiting"
  | "running"
  | "succeeded"
  | "empty"
  | "failed"
  | "cancelled";

export type JobPhase =
  | "starting"
  | "browser"
  | "navigating"
  | "collecting"
  | "validating"
  | "exporting"
  | "finished";

export interface JobProgress {
  collected: number;
  limit: number;
  iteration: number;
  max_iterations: number;
  stagnant: number;
  stagnant_threshold: number | null;
  unique_ig_profiles: number | null;
  retries: number;
  raw_unique: number | null;
  validated: number | null;
  discarded: number | null;
  wait_remaining_seconds?: number | null;
}

export interface LogEntry {
  seq: number;
  ts: string;
  level: string;
  message: string;
  raw: string;
}

export interface WarningEvent {
  kind: "retry" | "validation" | "navigation";
  message: string;
  ts: string;
}

export interface Job {
  id: string;
  batch_id?: string | null;
  request: ScrapeRequest;
  command: string[];
  status: JobStatus;
  phase?: JobPhase | null;
  progress: JobProgress;
  search_url?: string | null;
  result_file?: string | null;
  error?: string | null;
  exit_code?: number | null;
  pid?: number | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  pause_before?: number;
}

export interface JobsListResponse {
  items: Job[];
  total: number;
}

export interface AdRecord {
  ad_id: string;
  page_id: string | null;
  page_name: string | null;
  ad_text: string | null;
  ad_caption: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "ACTIVE" | "INACTIVE" | string | null;
  image_url: string | null;
  video_url: string | null;
  landing_page: string | null;
  snapshot_url: string | null;
  ig_username: string | null;
  platforms: string[];
}

export interface ResultFile {
  filename: string;
  label: string;
  ig_profiles_only: boolean;
  format: ExportFormat;
  created_at: string;
  size_bytes: number;
  rows?: number | null;
  job_id?: string | null;
}

export interface ResultDetailResponse {
  file: ResultFile;
  rows: AdRecord[];
}

export interface MergeRequest {
  filenames: string[];
  dedupe_by: "ad_id" | "ig_username" | "page_id";
}

export interface MergeResponse {
  rows: AdRecord[];
  total_before_dedupe: number;
  total_after_dedupe: number;
}

export interface BatchRequest {
  queries: string[];
  base: ScrapeRequest;
  pause_seconds?: number;
}

export interface Batch {
  id: string;
  queries: string[];
  base: ScrapeRequest;
  pause_seconds: number;
  job_ids: string[];
  created_at: string;
}

export interface BatchDetailResponse {
  id: string;
  queries: string[];
  pause_seconds: number;
  created_at: string;
  jobs: Job[];
  status: string;
  total_jobs: number;
  completed_jobs: number;
  total_collected: number;
  total_limit: number;
}

// Backward-compatible alias
export type BatchJobSummary = BatchDetailResponse;

export interface CountryItem {
  code: string;
  name: string;
}

export interface CountryGroup {
  group: string;
  items: CountryItem[];
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  is_batch?: boolean;
  queries?: string[] | null;
  params: Record<string, unknown>;
  // Backward compatibility aliases:
  title?: string;
  request?: Partial<ScrapeRequest>;
  icon?: string;
}

export interface OptionsResponse {
  statuses: string[];
  platforms: string[];
  media_types: string[];
  defaults: Record<string, unknown>;
  countries: CountryGroup[];
  recipes: Recipe[];
  limits: {
    recommended_min: number;
    recommended_max: number;
    hard_max: number;
    [key: string]: unknown;
  };
  config: Record<string, unknown>;
}

export interface HealthResponse {
  status: "ok";
  version: string;
  python: string;
  playwright_ok: boolean;
  output_dir: string;
  queue_size: number;
  active_job_id?: string | null;
}

export interface JobStatusEvent {
  status: JobStatus;
  phase?: JobPhase | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface GlobalJobEvent {
  event: "status" | "progress" | "done";
  job_id: string;
  job?: Job | null;
}
