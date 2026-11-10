import * as React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Flame,
  Instagram,
  Layers,
  Merge,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { useMergeResults, useResult } from "@/api/queries/useResults";
import type { AdRecord } from "@/api/types";
import { dedupeAds, enrichAds, type EnrichedAd } from "@/lib/enrich";
import { formatDateTime, formatNumber, formatRelativeDate } from "@/lib/format";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { ErrorState } from "@/components/common/ErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { AdsToolbar, type AdsFilterState, INITIAL_FILTER_STATE } from "@/components/results/AdsToolbar";
import { AdsTable } from "@/components/results/AdsTable";
import { AdDetailSheet } from "@/components/results/AdDetailSheet";

export function ResultDetailPage() {
  const { filename } = useParams<{ filename: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isMergedMode = filename === "_merged";
  const mergeParam = searchParams.get("merge") || "";
  const mergeFiles = React.useMemo(() => {
    return mergeParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [mergeParam]);

  // Persist column visibility & dedupe preference across sessions
  const [savedColumns, setSavedColumns] = useLocalStorage<Record<string, boolean>>(
    "explorer:columns",
    {
      page_name: true,
      ig_username: true,
      start_date: true,
      days_active: true,
      landing_type: true,
      media: true,
      platforms: true,
      status: true,
      ad_text: true,
      ad_id: false,
      page_id: false,
      ad_caption: false,
      end_date: false,
      landing_page: false,
      snapshot_url: false,
    }
  );

  const [savedDedupe, setSavedDedupe] = useLocalStorage<boolean>(
    "explorer:dedupe",
    false
  );

  // Filters State
  const [filters, setFilters] = React.useState<AdsFilterState>({
    ...INITIAL_FILTER_STATE,
    dedupe: savedDedupe,
  });

  // Keep savedDedupe in sync when user toggles dedupe
  const handleFiltersChange = (
    updater: AdsFilterState | ((prev: AdsFilterState) => AdsFilterState)
  ) => {
    setFilters((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next.dedupe !== prev.dedupe) {
        setSavedDedupe(next.dedupe);
      }
      return next;
    });
  };

  // Selection & Sheet States
  const [selectedAds, setSelectedAds] = React.useState<EnrichedAd[]>([]);
  const [detailAd, setDetailAd] = React.useState<EnrichedAd | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);

  // Single file query (active when not in merged mode)
  const singleQueryResult = useResult(isMergedMode ? null : filename);

  // Merged mode mutation & state
  const mergeMutation = useMergeResults();
  const [mergedRows, setMergedRows] = React.useState<AdRecord[] | null>(null);
  const [mergeLoading, setMergeLoading] = React.useState(false);
  const [mergeError, setMergeError] = React.useState<string | null>(null);

  // Fetch merged results on mount / mergeParam change
  React.useEffect(() => {
    if (!isMergedMode) return;

    if (mergeFiles.length === 0) {
      setMergeError("No se especificaron archivos para fusionar.");
      return;
    }

    setMergeLoading(true);
    setMergeError(null);

    mergeMutation.mutate(
      {
        filenames: mergeFiles,
        dedupe_by: "ad_id",
      },
      {
        onSuccess: (data) => {
          setMergedRows(data.rows);
          setMergeLoading(false);
          toast.success(
            `Fusionados ${mergeFiles.length} archivos (${data.rows.length} anuncios)`
          );
        },
        onError: (err) => {
          setMergeError(err.message || "Error al fusionar archivos.");
          setMergeLoading(false);
        },
      }
    );
  }, [isMergedMode, mergeParam]);

  // Extract raw AdRecords
  const rawAds: AdRecord[] = React.useMemo(() => {
    if (isMergedMode) {
      return mergedRows ?? [];
    }
    return singleQueryResult.data?.rows ?? [];
  }, [isMergedMode, mergedRows, singleQueryResult.data?.rows]);

  // Enrich Ads (memoized)
  const enrichedAds = React.useMemo(() => {
    return enrichAds(rawAds);
  }, [rawAds]);

  // Global KPIs calculation from all enriched ads
  const kpis = React.useMemo(() => {
    const total = enrichedAds.length;
    const uniqueAdvertisers = dedupeAds(enrichedAds).length;
    const igProfilesCount = enrichedAds.filter((a) =>
      Boolean(a.ig_username && a.ig_username.trim().length > 0)
    ).length;
    const winnersCount = enrichedAds.filter((a) => a.is_winner).length;
    const videoCount = enrichedAds.filter((a) => a.has_video).length;

    return {
      total,
      uniqueAdvertisers,
      igProfilesCount,
      winnersCount,
      videoCount,
    };
  }, [enrichedAds]);

  // Filter Ads according to Toolbar controls
  const filteredAds = React.useMemo(() => {
    // 1. Base filter
    const filtered = enrichedAds.filter((ad) => {
      // Global Search
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        const inPageName = (ad.page_name ?? "").toLowerCase().includes(q);
        const inIgUser = (ad.ig_username ?? "").toLowerCase().includes(q);
        const inText = (ad.ad_text ?? "").toLowerCase().includes(q);
        const inCaption = (ad.ad_caption ?? "").toLowerCase().includes(q);
        const inLanding = (ad.landing_page ?? "").toLowerCase().includes(q);
        if (!inPageName && !inIgUser && !inText && !inCaption && !inLanding) {
          return false;
        }
      }

      // Status
      if (filters.status !== "ALL") {
        const adStatus = (ad.status ?? "").toUpperCase();
        if (adStatus !== filters.status.toUpperCase()) return false;
      }

      // Platform
      if (filters.platform !== "ALL") {
        const targetP = filters.platform.toLowerCase();
        const hasPlatform = (ad.platforms || []).some(
          (p) => p.toLowerCase() === targetP
        );
        if (!hasPlatform) return false;
      }

      // Destination / Landing type
      if (filters.landingType !== "ALL") {
        if (ad.landing_type !== filters.landingType) return false;
      }

      // Media format
      if (filters.mediaType !== "ALL") {
        if (filters.mediaType === "video" && !ad.has_video) return false;
        if (filters.mediaType === "image" && !ad.has_image) return false;
        if (filters.mediaType === "none" && (ad.has_video || ad.has_image))
          return false;
      }

      // Start Date (Min Date)
      if (filters.minDate) {
        if (!ad.start_date || ad.start_date < filters.minDate) return false;
      }

      // Only winners
      if (filters.onlyWinners && !ad.is_winner) {
        return false;
      }

      return true;
    });

    // 2. Dedupe by advertiser (if switch is active)
    if (filters.dedupe) {
      return dedupeAds(filtered);
    }

    return filtered;
  }, [enrichedAds, filters]);

  // Open detail sheet
  const handleOpenDetail = (ad: EnrichedAd) => {
    setDetailAd(ad);
    setIsDetailOpen(true);
  };

  const isLoading = isMergedMode ? mergeLoading : singleQueryResult.isLoading;
  const isError = isMergedMode ? Boolean(mergeError) : singleQueryResult.isError;
  const errorMessage = isMergedMode
    ? mergeError
    : singleQueryResult.error?.message;

  if (isError) {
    return (
      <div className="space-y-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/results")}
          className="gap-1.5 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Volver a Resultados</span>
        </Button>
        <ErrorState
          title={isMergedMode ? "Error al fusionar archivos" : "Error al cargar el archivo"}
          message={errorMessage || "No se pudieron obtener los anuncios."}
          onRetry={() => {
            if (isMergedMode) {
              window.location.reload();
            } else {
              singleQueryResult.refetch();
            }
          }}
        />
      </div>
    );
  }

  // File label / Title
  const singleFile = singleQueryResult.data?.file;
  const pageTitle = isMergedMode
    ? `Resultados Fusionados (${mergeFiles.length} archivos)`
    : singleFile?.label || filename || "Explorador de Anuncios";

  const exportBaseFilename = isMergedMode
    ? `merged_${mergeFiles.length}_files`
    : filename || "ads_export";

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="flex flex-col gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => navigate("/results")}
              title="Volver al listado de resultados"
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {pageTitle}
                </h1>
                {singleFile?.ig_profiles_only && (
                  <Badge variant="instagram" className="text-[10px] px-2 py-0.5">
                    Lead Gen IG
                  </Badge>
                )}
                {isMergedMode && (
                  <Badge variant="secondary" className="flex items-center gap-1 text-[10px]">
                    <Merge className="h-3 w-3 text-brand-500" />
                    <span>Vista Multibúsqueda</span>
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                {!isMergedMode && singleFile && (
                  <>
                    <span className="font-mono text-slate-400">{singleFile.filename}</span>
                    <span>•</span>
                    <Tooltip content={formatDateTime(singleFile.created_at)} side="bottom">
                      <span className="cursor-help">
                        {formatRelativeDate(singleFile.created_at)}
                      </span>
                    </Tooltip>
                    <span>•</span>
                  </>
                )}
                {isMergedMode && (
                  <>
                    <span className="text-slate-400">
                      Archivos: {mergeFiles.join(", ")}
                    </span>
                    <span>•</span>
                  </>
                )}
                <span>
                  {formatNumber(rawAds.length)} anuncios recolectados
                </span>
              </div>
            </div>
          </div>

          {!isMergedMode && filename && (
            <a
              href={`/api/results/${encodeURIComponent(filename)}/download`}
              download={filename}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-8 gap-1.5 text-xs inline-flex items-center"
              )}
            >
              <Download className="h-3.5 w-3.5" />
              <span>Descargar archivo original</span>
            </a>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Total Ads */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3.5 shadow-2xs">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 block">
                Total Anuncios
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {formatNumber(kpis.total)}
              </span>
            </div>
          </div>

          {/* Unique Advertisers */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3.5 shadow-2xs">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 block">
                Anunciantes Únicos
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {formatNumber(kpis.uniqueAdvertisers)}
              </span>
            </div>
          </div>

          {/* IG Profiles */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3.5 shadow-2xs">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
              <Instagram className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 block">
                Perfiles Instagram
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {formatNumber(kpis.igProfilesCount)}
              </span>
            </div>
          </div>

          {/* Winning Ads (>= 30 days) */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3.5 shadow-2xs">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 block">
                Ganadores (≥ 30d)
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {formatNumber(kpis.winnersCount)}
              </span>
            </div>
          </div>

          {/* Video Creatives */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3.5 shadow-2xs col-span-2 sm:col-span-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 block">
                Con Vídeo
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {formatNumber(kpis.videoCount)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Explorer Toolbar */}
      <AdsToolbar
        totalAdsCount={enrichedAds.length}
        uniqueAdvertisersCount={kpis.uniqueAdvertisers}
        filteredAds={filteredAds}
        selectedAds={selectedAds}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        visibleColumns={savedColumns}
        onVisibleColumnsChange={setSavedColumns}
        baseFilename={exportBaseFilename}
      />

      {/* Explorer Virtualized Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : (
        <AdsTable
          ads={filteredAds}
          selectedAds={selectedAds}
          onSelectedAdsChange={setSelectedAds}
          onSelectAd={handleOpenDetail}
          visibleColumns={savedColumns}
          onVisibleColumnsChange={setSavedColumns}
          isLoading={isLoading}
        />
      )}

      {/* Ad Detail Sheet (Slide-over drawer) */}
      <AdDetailSheet
        ad={detailAd}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  );
}

export default ResultDetailPage;
