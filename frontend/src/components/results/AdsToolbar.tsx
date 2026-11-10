import * as React from "react";
import {
  AtSign,
  Filter,
  Flame,
  Layers,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { EnrichedAd } from "@/lib/enrich";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ColumnPicker } from "./ColumnPicker";
import { ExportMenu } from "./ExportMenu";

export interface AdsFilterState {
  search: string;
  status: string; // "ALL" | "ACTIVE" | "INACTIVE"
  platform: string; // "ALL" | "instagram" | "facebook" | "messenger" | "audience_network"
  landingType: string; // "ALL" | LandingType
  mediaType: string; // "ALL" | "video" | "image" | "none"
  minDate: string;
  maxDate: string;
  dedupe: boolean;
  onlyWinners: boolean;
}

export const INITIAL_FILTER_STATE: AdsFilterState = {
  search: "",
  status: "ALL",
  platform: "ALL",
  landingType: "ALL",
  mediaType: "ALL",
  minDate: "",
  maxDate: "",
  dedupe: false,
  onlyWinners: false,
};

export interface AdsToolbarProps {
  totalAdsCount: number;
  uniqueAdvertisersCount: number;
  filteredAds: EnrichedAd[];
  selectedAds: EnrichedAd[];
  filters: AdsFilterState;
  onFiltersChange: (filters: AdsFilterState | ((prev: AdsFilterState) => AdsFilterState)) => void;
  visibleColumns: Record<string, boolean>;
  onVisibleColumnsChange: (cols: Record<string, boolean>) => void;
  baseFilename?: string;
  className?: string;
}

export function AdsToolbar({
  totalAdsCount,
  uniqueAdvertisersCount,
  filteredAds,
  selectedAds,
  filters,
  onFiltersChange,
  visibleColumns,
  onVisibleColumnsChange,
  baseFilename,
  className,
}: AdsToolbarProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = React.useState(false);

  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.status !== "ALL" ||
    filters.platform !== "ALL" ||
    filters.landingType !== "ALL" ||
    filters.mediaType !== "ALL" ||
    filters.minDate !== "" ||
    filters.maxDate !== "" ||
    filters.onlyWinners;

  const handleResetFilters = () => {
    onFiltersChange((prev) => ({
      ...INITIAL_FILTER_STATE,
      dedupe: prev.dedupe, // Preserve dedupe preference
    }));
  };

  // Copy unique @usernames from selected (or all filtered) ads
  const handleCopyUsernames = async () => {
    const targetAds = selectedAds.length > 0 ? selectedAds : filteredAds;
    const uniqueUsernames = Array.from(
      new Set(
        targetAds
          .map((a) => a.ig_username?.trim())
          .filter((u): u is string => Boolean(u && u.length > 0))
          .map((u) => (u.startsWith("@") ? u : `@${u}`))
      )
    );

    if (uniqueUsernames.length === 0) {
      toast.warning("No se encontraron perfiles de Instagram en la vista actual");
      return;
    }

    const textToCopy = uniqueUsernames.join("\n");
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const ta = document.createElement("textarea");
        ta.value = textToCopy;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success(
        `${uniqueUsernames.length} @usuarios copiados al portapapeles`
      );
    } catch {
      toast.error("Error al copiar los usuarios al portapapeles");
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Top Main Row: Search, Main Toggles, Actions */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        {/* Global Search */}
        <div className="relative flex-1 min-w-[240px] max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar en texto, anunciante, @usuario, titular o landing..."
            value={filters.search}
            onChange={(e) =>
              onFiltersChange((prev) => ({ ...prev, search: e.target.value }))
            }
            className="pl-9 pr-8 h-9 text-xs"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() =>
                onFiltersChange((prev) => ({ ...prev, search: "" }))
              }
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Advanced Filters Button */}
          <Button
            type="button"
            variant={showAdvancedFilters || hasActiveFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <span>Filtros</span>
            {hasActiveFilters && (
              <span className="h-2 w-2 rounded-full bg-brand-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </Button>

          {/* Copy @usernames Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyUsernames}
            className="h-8 gap-1.5 text-xs font-medium"
            title="Copiar lista de perfiles de Instagram al portapapeles"
          >
            <AtSign className="h-3.5 w-3.5 text-rose-500" />
            <span>Copiar @usuarios</span>
          </Button>

          {/* Column Visibility Picker */}
          <ColumnPicker
            visibleColumns={visibleColumns}
            onChange={onVisibleColumnsChange}
          />

          {/* Export Dropdown Menu */}
          <ExportMenu
            filteredAds={filteredAds}
            selectedAds={selectedAds}
            baseFilename={baseFilename}
          />
        </div>
      </div>

      {/* Secondary Bar: Dedupe switch, Winners switch, Quick stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-3.5 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-5">
          {/* Dedupe Switch: 1 fila por anunciante */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Switch
              checked={filters.dedupe}
              onCheckedChange={(checked) =>
                onFiltersChange((prev) => ({ ...prev, dedupe: checked }))
              }
            />
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-brand-500" />
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                1 fila por anunciante
              </span>
              <span className="text-slate-500 text-[11px]">
                ({uniqueAdvertisersCount} únicos de {totalAdsCount})
              </span>
            </div>
          </label>

          {/* Only Winners Switch: >= 30 días activo */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Switch
              checked={filters.onlyWinners}
              onCheckedChange={(checked) =>
                onFiltersChange((prev) => ({ ...prev, onlyWinners: checked }))
              }
            />
            <div className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Solo ganadores
              </span>
              <span className="text-slate-500 text-[11px]">(≥ 30 días)</span>
            </div>
          </label>
        </div>

        {/* Status / Selection summary */}
        <div className="flex items-center gap-2 text-slate-500 text-[11px]">
          {selectedAds.length > 0 && (
            <Badge variant="default" className="font-semibold">
              {selectedAds.length} seleccionados
            </Badge>
          )}

          <span>
            Mostrando <strong className="text-slate-900 dark:text-slate-100">{filteredAds.length}</strong> de{" "}
            <strong>{filters.dedupe ? uniqueAdvertisersCount : totalAdsCount}</strong>
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-medium ml-2 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filter Collapsible Bar */}
      {showAdvancedFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-3 shadow-xs animate-in fade-in slide-in-from-top-1 text-xs">
          {/* Status */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">
              Estado
            </label>
            <Select
              value={filters.status}
              onChange={(e) =>
                onFiltersChange((prev) => ({ ...prev, status: e.target.value }))
              }
              className="h-8 text-xs"
            >
              <option value="ALL">Todos los estados</option>
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
            </Select>
          </div>

          {/* Platform */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">
              Plataforma
            </label>
            <Select
              value={filters.platform}
              onChange={(e) =>
                onFiltersChange((prev) => ({
                  ...prev,
                  platform: e.target.value,
                }))
              }
              className="h-8 text-xs"
            >
              <option value="ALL">Todas las plataformas</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="messenger">Messenger</option>
              <option value="audience_network">Audience Network</option>
            </Select>
          </div>

          {/* Destination / Landing Type */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">
              Tipo de Destino
            </label>
            <Select
              value={filters.landingType}
              onChange={(e) =>
                onFiltersChange((prev) => ({
                  ...prev,
                  landingType: e.target.value,
                }))
              }
              className="h-8 text-xs"
            >
              <option value="ALL">Todos los destinos</option>
              <option value="instagram">Instagram (Perfil)</option>
              <option value="whatsapp">WhatsApp Directo</option>
              <option value="calendly">Calendly (Reuniones)</option>
              <option value="linktree">Linktree / Beacons</option>
              <option value="facebook">Facebook / Fanpage</option>
              <option value="web">Sitio Web Externo</option>
              <option value="none">Sin enlace externo</option>
            </Select>
          </div>

          {/* Media Format */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">
              Formato Creativo
            </label>
            <Select
              value={filters.mediaType}
              onChange={(e) =>
                onFiltersChange((prev) => ({
                  ...prev,
                  mediaType: e.target.value,
                }))
              }
              className="h-8 text-xs"
            >
              <option value="ALL">Todos los formatos</option>
              <option value="video">Solo con Vídeo</option>
              <option value="image">Solo con Imagen</option>
              <option value="none">Sin creativo</option>
            </Select>
          </div>

          {/* Date Range: Min date */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500">
              Fecha de Inicio (Desde)
            </label>
            <Input
              type="date"
              value={filters.minDate}
              onChange={(e) =>
                onFiltersChange((prev) => ({
                  ...prev,
                  minDate: e.target.value,
                }))
              }
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
