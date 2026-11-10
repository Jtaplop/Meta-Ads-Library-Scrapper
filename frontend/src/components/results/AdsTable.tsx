import * as React from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowUpDown,
  ExternalLink,
  Flame,
  Image as ImageIcon,
  Instagram,
  Layers,
  Video,
} from "lucide-react";
import type { EnrichedAd } from "@/lib/enrich";
import { formatDateTime } from "@/lib/format";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/common/CopyButton";
import { EmptyState } from "@/components/common/EmptyState";
import { LandingTypeBadge } from "./LandingTypeBadge";
import { cn } from "@/lib/cn";

export interface AdsTableProps {
  ads: EnrichedAd[];
  selectedAds: EnrichedAd[];
  onSelectedAdsChange: (ads: EnrichedAd[]) => void;
  onSelectAd: (ad: EnrichedAd) => void;
  visibleColumns: Record<string, boolean>;
  onVisibleColumnsChange?: (cols: Record<string, boolean>) => void;
  isLoading?: boolean;
  className?: string;
}

export function AdsTable({
  ads,
  selectedAds,
  onSelectedAdsChange,
  onSelectAd,
  visibleColumns,
  isLoading = false,
  className,
}: AdsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "start_date", desc: true },
  ]);

  // Map selectedAds to RowSelectionState by ad_id
  const rowSelection: RowSelectionState = React.useMemo(() => {
    const map: RowSelectionState = {};
    for (const ad of selectedAds) {
      map[ad.ad_id] = true;
    }
    return map;
  }, [selectedAds]);

  // Define Columns
  const columns = React.useMemo<ColumnDef<EnrichedAd>[]>(() => {
    return [
      // Checkbox Column
      {
        id: "select",
        header: ({ table }) => {
          const isAllSelected = table.getIsAllRowsSelected();
          const isSomeSelected = table.getIsSomeRowsSelected();
          return (
            <div className="flex items-center justify-center px-1" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isAllSelected || isSomeSelected}
                onCheckedChange={(checked) => {
                  table.toggleAllRowsSelected(Boolean(checked));
                }}
                aria-label="Seleccionar todos"
              />
            </div>
          );
        },
        cell: ({ row }) => (
          <div
            className="flex items-center justify-center px-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
              aria-label={`Seleccionar anuncio ${row.original.ad_id}`}
            />
          </div>
        ),
        enableSorting: false,
        size: 40,
      },

      // Advertiser (Page Name)
      {
        accessorKey: "page_name",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 hover:text-brand-500"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span>Anunciante</span>
            <ArrowUpDown className="h-3 w-3 text-slate-400" />
          </button>
        ),
        cell: ({ row }) => {
          const ad = row.original;
          return (
            <div className="flex items-center gap-2 max-w-[220px]">
              <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                {ad.page_name || "Sin nombre"}
              </span>
              {ad.ads_count && ad.ads_count > 1 && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                  <Layers className="h-2.5 w-2.5" />
                  {ad.ads_count}
                </span>
              )}
            </div>
          );
        },
      },

      // Instagram Username
      {
        accessorKey: "ig_username",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 hover:text-brand-500"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span>@usuario (IG)</span>
            <ArrowUpDown className="h-3 w-3 text-slate-400" />
          </button>
        ),
        cell: ({ row }) => {
          const username = row.original.ig_username;
          if (!username) return <span className="text-slate-400 text-xs">—</span>;

          const cleanUser = username.replace(/^@/, "").trim();
          return (
            <div
              className="flex items-center gap-1.5 max-w-[170px]"
              onClick={(e) => e.stopPropagation()}
            >
              <a
                href={`https://www.instagram.com/${cleanUser}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-xs text-rose-600 dark:text-rose-400 hover:underline truncate inline-flex items-center gap-1"
                title={`Abrir @${cleanUser} en Instagram`}
              >
                <Instagram className="h-3 w-3 shrink-0" />
                <span className="truncate">@{cleanUser}</span>
              </a>
              <CopyButton
                value={`@${cleanUser}`}
                successMessage={`@${cleanUser} copiado`}
                size="icon-sm"
                className="h-5 w-5 shrink-0 opacity-60 hover:opacity-100"
              />
            </div>
          );
        },
      },

      // Start Date
      {
        accessorKey: "start_date",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 hover:text-brand-500"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span>Inicio</span>
            <ArrowUpDown className="h-3 w-3 text-slate-400" />
          </button>
        ),
        cell: ({ row }) => {
          const dateStr = row.original.start_date;
          return (
            <span className="text-xs text-slate-600 dark:text-slate-300 font-mono whitespace-nowrap">
              {dateStr ? formatDateTime(dateStr, "dd/MM/yyyy") : "—"}
            </span>
          );
        },
      },

      // Days Active
      {
        accessorKey: "days_active",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 hover:text-brand-500"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span>Días</span>
            <ArrowUpDown className="h-3 w-3 text-slate-400" />
          </button>
        ),
        cell: ({ row }) => {
          const ad = row.original;
          const days = ad.days_active;
          return (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                {days !== null ? `${days}d` : "—"}
              </span>
              {ad.is_winner && (
                <span
                  title="Anuncio ganador: activo más de 30 días"
                  className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 text-[10px] font-bold"
                >
                  <Flame className="h-2.5 w-2.5 fill-amber-500" />
                  Winner
                </span>
              )}
            </div>
          );
        },
      },

      // Destination Landing Type
      {
        accessorKey: "landing_type",
        header: "Destino",
        cell: ({ row }) => {
          const ad = row.original;
          return (
            <div
              className="flex items-center gap-1"
              onClick={(e) => {
                if (ad.landing_page) e.stopPropagation();
              }}
            >
              <LandingTypeBadge
                type={ad.landing_type}
                domain={ad.landing_domain}
                url={ad.landing_page}
              />
              {ad.landing_page && (
                <a
                  href={ad.landing_page}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                  title="Abrir destino en pestaña nueva"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          );
        },
      },

      // Media indicator
      {
        id: "media",
        header: "Medio",
        cell: ({ row }) => {
          const ad = row.original;
          if (ad.has_video) {
            return (
              <span className="inline-flex items-center gap-1 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 text-[10px] font-medium">
                <Video className="h-3 w-3" />
                <span>Vídeo</span>
              </span>
            );
          }
          if (ad.has_image) {
            return (
              <span className="inline-flex items-center gap-1 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 text-[10px] font-medium">
                <ImageIcon className="h-3 w-3" />
                <span>Imagen</span>
              </span>
            );
          }
          return <span className="text-[11px] text-slate-400 italic">Sin medio</span>;
        },
      },

      // Platforms
      {
        accessorKey: "platforms",
        header: "Plataformas",
        cell: ({ row }) => {
          const platforms = row.original.platforms || [];
          if (platforms.length === 0) return <span className="text-slate-400 text-xs">—</span>;

          return (
            <div className="flex flex-wrap gap-1 max-w-[140px]">
              {platforms.map((p) => {
                const lower = p.toLowerCase();
                let label = p;
                if (lower === "facebook") label = "FB";
                else if (lower === "instagram") label = "IG";
                else if (lower === "messenger") label = "MSG";
                else if (lower === "audience_network") label = "AN";

                return (
                  <span
                    key={p}
                    title={p}
                    className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.2 text-[10px] font-medium text-slate-600 dark:text-slate-300"
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          );
        },
      },

      // Status
      {
        accessorKey: "status",
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 hover:text-brand-500"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span>Estado</span>
            <ArrowUpDown className="h-3 w-3 text-slate-400" />
          </button>
        ),
        cell: ({ row }) => {
          const status = (row.original.status ?? "").toUpperCase();
          return status === "ACTIVE" ? (
            <Badge variant="success" className="text-[11px] px-2 py-0">
              Activo
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[11px] px-2 py-0">
              Inactivo
            </Badge>
          );
        },
      },

      // Copy Preview (ad_text)
      {
        accessorKey: "ad_text",
        header: "Texto del anuncio (Copy)",
        cell: ({ row }) => {
          const text = row.original.ad_text;
          if (!text) return <span className="text-slate-400 text-xs italic">Sin texto</span>;

          return (
            <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-400 max-w-[280px] xl:max-w-[360px] leading-relaxed">
              {text}
            </p>
          );
        },
      },

      // Optional: ad_id
      {
        accessorKey: "ad_id",
        header: "ID Anuncio",
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-slate-500">{row.original.ad_id}</span>
        ),
      },

      // Optional: page_id
      {
        accessorKey: "page_id",
        header: "ID Página",
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-slate-500">
            {row.original.page_id || "—"}
          </span>
        ),
      },

      // Optional: ad_caption
      {
        accessorKey: "ad_caption",
        header: "Titular",
        cell: ({ row }) => (
          <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[200px] block font-medium">
            {row.original.ad_caption || "—"}
          </span>
        ),
      },

      // Optional: end_date
      {
        accessorKey: "end_date",
        header: "Fecha fin",
        cell: ({ row }) => (
          <span className="text-xs text-slate-500 font-mono">
            {row.original.end_date ? formatDateTime(row.original.end_date, "dd/MM/yyyy") : "—"}
          </span>
        ),
      },

      // Optional: landing_page
      {
        accessorKey: "landing_page",
        header: "URL Destino",
        cell: ({ row }) => {
          const lp = row.original.landing_page;
          if (!lp) return <span className="text-slate-400 text-xs">—</span>;
          return (
            <a
              href={lp}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-brand-500 hover:underline truncate max-w-[180px] block"
              title={lp}
            >
              {lp}
            </a>
          );
        },
      },

      // Optional: snapshot_url
      {
        accessorKey: "snapshot_url",
        header: "Meta Library URL",
        cell: ({ row }) => {
          const snap = row.original.snapshot_url;
          if (!snap) return <span className="text-slate-400 text-xs">—</span>;
          return (
            <a
              href={snap}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-brand-500 hover:underline inline-flex items-center gap-1"
            >
              <span>Ver snapshot</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          );
        },
      },
    ];
  }, []);

  // Compute column visibility object for TanStack Table
  const columnVisibility = React.useMemo(() => {
    return {
      select: true, // Always show selection
      page_name: visibleColumns.page_name ?? true,
      ig_username: visibleColumns.ig_username ?? true,
      start_date: visibleColumns.start_date ?? true,
      days_active: visibleColumns.days_active ?? true,
      landing_type: visibleColumns.landing_type ?? true,
      media: visibleColumns.media ?? true,
      platforms: visibleColumns.platforms ?? true,
      status: visibleColumns.status ?? true,
      ad_text: visibleColumns.ad_text ?? true,
      ad_id: visibleColumns.ad_id ?? false,
      page_id: visibleColumns.page_id ?? false,
      ad_caption: visibleColumns.ad_caption ?? false,
      end_date: visibleColumns.end_date ?? false,
      landing_page: visibleColumns.landing_page ?? false,
      snapshot_url: visibleColumns.snapshot_url ?? false,
    };
  }, [visibleColumns]);

  const table = useReactTable({
    data: ads,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
    },
    getRowId: (row) => row.ad_id,
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      const nextSelection =
        typeof updater === "function" ? updater(rowSelection) : updater;

      const selectedMap = new Set(Object.keys(nextSelection));
      const nextSelectedAds = ads.filter((ad) => selectedMap.has(ad.ad_id));
      onSelectedAdsChange(nextSelectedAds);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
  });

  const { rows } = table.getRowModel();
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 64,
    overscan: 12,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
      : 0;

  if (!isLoading && ads.length === 0) {
    return (
      <EmptyState
        title="No se encontraron anuncios"
        description="No hay anuncios que coincidan con los filtros aplicados en esta vista."
        className="my-6"
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs flex flex-col",
        className
      )}
    >
      <div
        ref={tableContainerRef}
        className="overflow-auto max-h-[calc(100vh-320px)] min-h-[400px] relative scrollbar-thin"
      >
        <table className="w-full text-left border-collapse text-xs">
          {/* Sticky Table Header */}
          <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-2xs">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs tracking-tight whitespace-nowrap bg-slate-50 dark:bg-slate-900"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          {/* Virtualized Body */}
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {paddingTop > 0 && (
              <tr>
                <td
                  style={{ height: `${paddingTop}px` }}
                  colSpan={columns.length}
                  className="p-0 border-0"
                />
              </tr>
            )}

            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              const isSelected = row.getIsSelected();

              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  onClick={() => onSelectAd(row.original)}
                  className={cn(
                    "cursor-pointer transition-colors duration-100 hover:bg-slate-50/80 dark:hover:bg-slate-800/50",
                    isSelected && "bg-brand-500/10 dark:bg-brand-500/15"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="p-3 align-middle text-slate-700 dark:text-slate-300"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}

            {paddingBottom > 0 && (
              <tr>
                <td
                  style={{ height: `${paddingBottom}px` }}
                  colSpan={columns.length}
                  className="p-0 border-0"
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
