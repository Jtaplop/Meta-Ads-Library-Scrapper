import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Download,
  Eye,
  FileCode,
  FileSpreadsheet,
  FolderOpen,
  Merge,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useDeleteResult, useResults } from "@/api/queries/useResults";
import type { ResultFile } from "@/api/types";
import { formatBytes, formatDateTime, formatNumber, formatRelativeDate } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";

export function ResultsPage() {
  const navigate = useNavigate();

  // Search and filter states
  const [search, setSearch] = React.useState("");
  const [formatFilter, setFormatFilter] = React.useState<string>("ALL");
  const [igOnlyFilter, setIgOnlyFilter] = React.useState<string>("ALL");

  // Selection state for merging
  const [selectedFilenames, setSelectedFilenames] = React.useState<Set<string>>(
    new Set()
  );

  // File to delete state (for ConfirmDialog)
  const [fileToDelete, setFileToDelete] = React.useState<ResultFile | null>(null);

  const {
    data: files = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useResults();

  const deleteResultMutation = useDeleteResult();

  // Client-side filtering
  const filteredFiles = React.useMemo(() => {
    return files.filter((file) => {
      // Search in label or filename
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesLabel = file.label.toLowerCase().includes(q);
        const matchesFilename = file.filename.toLowerCase().includes(q);
        if (!matchesLabel && !matchesFilename) return false;
      }

      // Format filter
      if (formatFilter !== "ALL" && file.format.toLowerCase() !== formatFilter.toLowerCase()) {
        return false;
      }

      // IG Only filter
      if (igOnlyFilter === "IG_ONLY" && !file.ig_profiles_only) {
        return false;
      }
      if (igOnlyFilter === "ALL_MODES" && file.ig_profiles_only) {
        return false;
      }

      return true;
    });
  }, [files, search, formatFilter, igOnlyFilter]);

  // Handle Select All
  const isAllSelected =
    filteredFiles.length > 0 &&
    filteredFiles.every((f) => selectedFilenames.has(f.filename));
  const isSomeSelected =
    filteredFiles.some((f) => selectedFilenames.has(f.filename)) &&
    !isAllSelected;

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allNames = new Set(selectedFilenames);
      for (const f of filteredFiles) {
        allNames.add(f.filename);
      }
      setSelectedFilenames(allNames);
    } else {
      const next = new Set(selectedFilenames);
      for (const f of filteredFiles) {
        next.delete(f.filename);
      }
      setSelectedFilenames(next);
    }
  };

  const handleToggleFileSelection = (filename: string) => {
    const next = new Set(selectedFilenames);
    if (next.has(filename)) {
      next.delete(filename);
    } else {
      next.add(filename);
    }
    setSelectedFilenames(next);
  };

  // Merge selected files and navigate
  const handleMergeAndExplore = () => {
    if (selectedFilenames.size < 2) {
      toast.warning("Selecciona al menos 2 archivos para fusionar");
      return;
    }
    const filenamesParam = Array.from(selectedFilenames).join(",");
    navigate(`/results/_merged?merge=${encodeURIComponent(filenamesParam)}`);
  };

  // Delete confirmation
  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    try {
      await deleteResultMutation.mutateAsync(fileToDelete.filename);
      toast.success(`Archivo "${fileToDelete.label}" eliminado`);
      setSelectedFilenames((prev) => {
        const next = new Set(prev);
        next.delete(fileToDelete.filename);
        return next;
      });
      setFileToDelete(null);
    } catch {
      toast.error("No se pudo eliminar el archivo");
    }
  };

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Resultados y Ficheros"
          description="Explora, descarga y analiza los resultados guardados por el scraper."
        />
        <ErrorState
          title="Error al cargar los resultados"
          message={error?.message || "No se pudo conectar con la API."}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Resultados y Ficheros"
        description="Historial completo de salidas en formato CSV y JSON generadas por el scraper."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw className={isRefetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              <span>Actualizar</span>
            </Button>
            <Link
              to="/scrape/new"
              className={cn(buttonVariants({ size: "sm" }), "h-8 gap-1.5 text-xs")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Nuevo Scrape</span>
            </Link>
          </div>
        }
      />

      {/* Floating / Sticky Merge Action Bar when multiple selected */}
      {selectedFilenames.size > 0 && (
        <div className="sticky top-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-500/40 bg-brand-50 dark:bg-brand-950/70 p-3.5 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white text-xs font-bold">
              {selectedFilenames.size}
            </span>
            <span className="text-xs font-semibold text-brand-950 dark:text-brand-100">
              {selectedFilenames.size} {selectedFilenames.size === 1 ? "archivo seleccionado" : "archivos seleccionados"}
            </span>
            <span className="text-xs text-brand-700 dark:text-brand-300 hidden sm:inline">
              — Combina y deduplica leads de varias búsquedas
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFilenames(new Set())}
              className="h-7 text-xs text-brand-700 dark:text-brand-300 hover:bg-brand-100/60 dark:hover:bg-brand-900/40"
            >
              Deseleccionar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleMergeAndExplore}
              disabled={selectedFilenames.size < 2}
              className="h-8 gap-1.5 text-xs font-semibold shadow-sm"
            >
              <Merge className="h-3.5 w-3.5" />
              <span>Fusionar seleccionados ({selectedFilenames.size}) y explorar</span>
            </Button>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative w-full sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar por término de búsqueda o nombre de fichero..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Format Filter */}
        <div className="w-full sm:w-44">
          <Select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="h-9 text-xs"
          >
            <option value="ALL">Todos los formatos</option>
            <option value="csv">Solo CSV</option>
            <option value="json">Solo JSON</option>
          </Select>
        </div>

        {/* Mode Filter */}
        <div className="w-full sm:w-52">
          <Select
            value={igOnlyFilter}
            onChange={(e) => setIgOnlyFilter(e.target.value)}
            className="h-9 text-xs"
          >
            <option value="ALL">Todos los modos</option>
            <option value="IG_ONLY">Solo perfiles IG (Lead Gen)</option>
            <option value="ALL_MODES">Estándar (Todos los anuncios)</option>
          </Select>
        </div>
      </div>

      {/* Results Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredFiles.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={files.length === 0 ? "Aún no hay resultados generados" : "Sin resultados"}
          description={
            files.length === 0
              ? "Lanza tu primera búsqueda desde 'Nuevo Scrape' para comenzar a extraer anuncios y recopilar leads de Meta Ads."
              : "No se encontraron ficheros que coincidan con la búsqueda y filtros seleccionados."
          }
          action={
            files.length === 0 ? (
              <Link
                to="/scrape/new"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Iniciar primer scrape
              </Link>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setFormatFilter("ALL");
                  setIgOnlyFilter("ALL");
                }}
              >
                Limpiar filtros
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="p-3.5 w-10 text-center">
                    <Checkbox
                      checked={isAllSelected || isSomeSelected}
                      onCheckedChange={(checked) =>
                        handleToggleSelectAll(Boolean(checked))
                      }
                      aria-label="Seleccionar todos los ficheros"
                    />
                  </th>
                  <th className="p-3.5 font-semibold">Término / Etiqueta</th>
                  <th className="p-3.5 font-semibold">Formato</th>
                  <th className="p-3.5 font-semibold">Filas / Anuncios</th>
                  <th className="p-3.5 font-semibold">Tamaño</th>
                  <th className="p-3.5 font-semibold">Fecha de Creación</th>
                  <th className="p-3.5 font-semibold text-right pr-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredFiles.map((file) => {
                  const isSelected = selectedFilenames.has(file.filename);
                  const isCsv = file.format.toLowerCase() === "csv";

                  return (
                    <tr
                      key={file.filename}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected ? "bg-brand-500/5 dark:bg-brand-500/10" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() =>
                            handleToggleFileSelection(file.filename)
                          }
                          aria-label={`Seleccionar ${file.label}`}
                        />
                      </td>

                      {/* Label + Mode */}
                      <td className="p-3.5">
                        <div className="flex flex-col gap-1 max-w-sm">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/results/${encodeURIComponent(file.filename)}`}
                              className="font-semibold text-slate-900 dark:text-slate-100 hover:text-brand-500 transition-colors text-xs truncate"
                              title={file.label}
                            >
                              {file.label}
                            </Link>

                            {file.ig_profiles_only && (
                              <Badge variant="instagram" className="text-[10px] px-1.5 py-0">
                                Lead Gen IG
                              </Badge>
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-slate-400 truncate">
                            {file.filename}
                          </span>
                        </div>
                      </td>

                      {/* Format Badge */}
                      <td className="p-3.5">
                        {isCsv ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-semibold border border-emerald-500/25">
                            <FileSpreadsheet className="h-3 w-3" />
                            <span>CSV</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[10px] font-semibold border border-amber-500/25">
                            <FileCode className="h-3 w-3" />
                            <span>JSON</span>
                          </span>
                        )}
                      </td>

                      {/* Rows count */}
                      <td className="p-3.5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {file.rows !== null && file.rows !== undefined
                          ? `${formatNumber(file.rows)} anuncios`
                          : "—"}
                      </td>

                      {/* Size */}
                      <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatBytes(file.size_bytes)}
                      </td>

                      {/* Created date with relative + full timestamp tooltip */}
                      <td className="p-3.5 whitespace-nowrap">
                        <Tooltip content={formatDateTime(file.created_at)} side="top">
                          <span className="text-slate-600 dark:text-slate-400 cursor-help border-b border-dotted border-slate-400">
                            {formatRelativeDate(file.created_at)}
                          </span>
                        </Tooltip>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right pr-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {/* Explore */}
                          <Link
                            to={`/results/${encodeURIComponent(file.filename)}`}
                            className={cn(
                              buttonVariants({ variant: "default", size: "sm" }),
                              "h-7 px-2.5 text-xs gap-1 font-medium"
                            )}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Explorar</span>
                          </Link>

                          {/* Download Original File */}
                          <a
                            href={`/api/results/${encodeURIComponent(file.filename)}/download`}
                            download={file.filename}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "icon-sm" }),
                              "h-7 w-7 text-slate-600 dark:text-slate-300"
                            )}
                            title="Descargar archivo original"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>

                          {/* Delete File */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setFileToDelete(file)}
                            className="h-7 w-7 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                            title="Borrar archivo"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={fileToDelete !== null}
        onOpenChange={(open) => !open && setFileToDelete(null)}
        title="¿Eliminar archivo de resultados?"
        description={`Esta acción eliminará de forma permanente el archivo "${fileToDelete?.filename}" de la carpeta de resultados output/. Esta operación no se puede deshacer.`}
        confirmLabel="Eliminar archivo"
        cancelLabel="Cancelar"
        variant="destructive"
        loading={deleteResultMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export default ResultsPage;
