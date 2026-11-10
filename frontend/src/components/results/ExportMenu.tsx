import * as React from "react";
import { Download, FileCode, FileSpreadsheet, X } from "lucide-react";
import { toast } from "sonner";
import type { EnrichedAd } from "@/lib/enrich";
import { exportAdsToCsv, exportAdsToJson } from "@/lib/exportCsv";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface ExportMenuProps {
  filteredAds: EnrichedAd[];
  selectedAds: EnrichedAd[];
  baseFilename?: string;
  className?: string;
}

export function ExportMenu({
  filteredAds,
  selectedAds,
  baseFilename = "meta_ads_export",
  className,
}: ExportMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close on click outside
  React.useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const hasSelection = selectedAds.length > 0;
  const targetAds = hasSelection ? selectedAds : filteredAds;
  const count = targetAds.length;

  const handleExport = (format: "csv" | "json", exportSelectionOnly: boolean) => {
    const adsToExport = exportSelectionOnly ? selectedAds : filteredAds;
    if (adsToExport.length === 0) {
      toast.warning("No hay anuncios para exportar");
      return;
    }

    const cleanBaseName = baseFilename.replace(/\.[^/.]+$/, "");
    const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `${cleanBaseName}_${exportSelectionOnly ? "selected_" : "filtered_"}${dateSuffix}.${format}`;

    try {
      if (format === "csv") {
        exportAdsToCsv(adsToExport, filename);
        toast.success(`Exportados ${adsToExport.length} anuncios a CSV`);
      } else {
        exportAdsToJson(adsToExport, filename);
        toast.success(`Exportados ${adsToExport.length} anuncios a JSON`);
      }
      setIsOpen(false);
    } catch {
      toast.error("Ocurrió un error al generar la exportación");
    }
  };

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={count === 0}
        className="h-8 gap-1.5 text-xs font-medium"
      >
        <Download className="h-3.5 w-3.5 text-slate-500" />
        <span>Exportar</span>
        {hasSelection && (
          <span className="rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-300 px-1.5 py-0.2 text-[10px] font-bold">
            {selectedAds.length}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-40 w-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xl animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                Exportar Anuncios
              </span>
              <span className="text-[11px] text-slate-400">
                {hasSelection
                  ? `${selectedAds.length} seleccionados de ${filteredAds.length}`
                  : `${filteredAds.length} anuncios filtrados`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            {hasSelection && (
              <>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Selección actual ({selectedAds.length})
                </div>
                <button
                  type="button"
                  onClick={() => handleExport("csv", true)}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-left text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div className="flex-1">
                    <div className="font-medium">CSV (Excel con BOM UTF-8)</div>
                    <div className="text-[10px] text-slate-400">
                      {selectedAds.length} filas seleccionadas
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("json", true)}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-left text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <FileCode className="h-4 w-4 text-amber-500" />
                  <div className="flex-1">
                    <div className="font-medium">JSON estructurado</div>
                    <div className="text-[10px] text-slate-400">
                      {selectedAds.length} objetos JSON
                    </div>
                  </div>
                </button>

                <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />
              </>
            )}

            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Vista completa filtrada ({filteredAds.length})
            </div>
            <button
              type="button"
              onClick={() => handleExport("csv", false)}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-left text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <div className="flex-1">
                <div className="font-medium">CSV (Excel con BOM UTF-8)</div>
                <div className="text-[10px] text-slate-400">
                  Todas las {filteredAds.length} filas filtradas
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleExport("json", false)}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-left text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <FileCode className="h-4 w-4 text-amber-500" />
              <div className="flex-1">
                <div className="font-medium">JSON estructurado</div>
                <div className="text-[10px] text-slate-400">
                  Todos los {filteredAds.length} anuncios
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
