import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  Search,
  Eye,
  Copy,
  RotateCcw,
  Ban,
  Trash2,
  FileSpreadsheet,
  Plus,
} from "lucide-react";
import {
  useJobs,
  useCancelJob,
  useRetryJob,
  useDeleteJob,
} from "@/api/queries/useJobs";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { CancelJobDialog } from "@/components/jobs/CancelJobDialog";
import { formatRelativeDate, formatDateTime, formatDuration } from "@/lib/format";
import { cn } from "@/lib/cn";

export function JobsPage() {
  const navigate = useNavigate();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);

  const { data: jobsResponse } = useJobs({ limit: 100 });
  const cancelJob = useCancelJob();
  const retryJob = useRetryJob();
  const deleteJob = useDeleteJob();

  const jobs = jobsResponse?.items || [];

  // Filter jobs by status & search query
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Status filter
      if (selectedStatus !== "all") {
        if (selectedStatus === "active") {
          if (!["queued", "waiting", "running"].includes(job.status)) return false;
        } else if (job.status !== selectedStatus) {
          return false;
        }
      }

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesQuery = job.request.query.toLowerCase().includes(q);
        const matchesId = job.id.toLowerCase().includes(q);
        const matchesCountry = (job.request.country || "").toLowerCase().includes(q);
        if (!matchesQuery && !matchesId && !matchesCountry) return false;
      }

      return true;
    });
  }, [jobs, selectedStatus, searchQuery]);

  const handleRetry = async (jobId: string) => {
    try {
      const newJob = await retryJob.mutateAsync(jobId);
      toast.success("Nuevo trabajo encolado");
      navigate(`/jobs/${newJob.id}`);
    } catch {
      toast.error("Error al reintentar el trabajo");
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar este trabajo del historial?")) return;
    try {
      await deleteJob.mutateAsync(jobId);
      toast.success("Trabajo eliminado del historial");
    } catch {
      toast.error("No se pudo eliminar el trabajo");
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingJobId) return;
    try {
      await cancelJob.mutateAsync(cancellingJobId);
      toast.info("Trabajo cancelado");
    } catch {
      toast.error("Error al cancelar el trabajo");
    } finally {
      setCancellingJobId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-primary" />
            <span>Historial y Cola de Trabajos</span>
          </div>
        }
        description="Monitoriza el estado de las ejecuciones, relanza scrapes fallidos o explora sus resultados generados."
        actions={
          <Button
            size="sm"
            onClick={() => navigate("/scrape/new")}
            className="gap-1.5 text-xs font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo scrape</span>
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: "Todos" },
            { id: "active", label: "En curso" },
            { id: "succeeded", label: "Completados" },
            { id: "empty", label: "Sin resultados" },
            { id: "failed", label: "Fallidos" },
            { id: "cancelled", label: "Cancelados" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors border",
                selectedStatus === tab.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Filtrar por búsqueda o ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Jobs Table */}
      {filteredJobs.length === 0 ? (
        <EmptyState
          title="No se encontraron trabajos"
          description={
            searchQuery || selectedStatus !== "all"
              ? "Prueba a cambiar o limpiar los filtros seleccionados."
              : "Todavía no has ejecutado ningún scrape. Lanza el primero para empezar."
          }
          action={
            <Button size="sm" onClick={() => navigate("/scrape/new")} className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              <span>Crear nuevo scrape</span>
            </Button>
          }
        />
      ) : (
        <Card className="border overflow-hidden shadow-sm bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/50 border-b border-border/80 text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">Búsqueda & Filtros</th>
                  <th className="py-2.5 px-3">Progreso</th>
                  <th className="py-2.5 px-3">Duración</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredJobs.map((job) => {
                  const isFinished = ["succeeded", "empty", "failed", "cancelled"].includes(
                    job.status
                  );
                  const isRunningOrWaiting = ["running", "waiting", "queued"].includes(job.status);

                  // Calculate duration
                  let durationStr = "—";
                  if (job.started_at) {
                    const start = new Date(job.started_at).getTime();
                    const end = job.finished_at ? new Date(job.finished_at).getTime() : Date.now();
                    durationStr = formatDuration(Math.max(0, Math.floor((end - start) / 1000)));
                  }

                  return (
                    <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                      {/* Status */}
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <JobStatusBadge
                          status={job.status}
                          waitRemainingSeconds={job.progress.wait_remaining_seconds}
                        />
                      </td>

                      {/* Query & Filter chips */}
                      <td className="py-3 px-3 align-top max-w-xs">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/jobs/${job.id}`}
                            className="font-semibold text-foreground hover:text-primary transition-colors hover:underline truncate"
                          >
                            {job.request.query}
                          </Link>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            #{job.id}
                          </span>
                        </div>

                        {/* Chips */}
                        <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px]">
                          <Badge variant="secondary" className="px-1.5 py-0 h-4 font-mono">
                            {job.request.country || "ALL"}
                          </Badge>
                          {job.request.platform && (
                            <Badge variant="outline" className="px-1.5 py-0 h-4">
                              {job.request.platform}
                            </Badge>
                          )}
                          {job.request.media_type && job.request.media_type !== "all" && (
                            <Badge variant="outline" className="px-1.5 py-0 h-4">
                              {job.request.media_type}
                            </Badge>
                          )}
                          {job.request.only_ig_profile && (
                            <Badge
                              variant="outline"
                              className="px-1.5 py-0 h-4 text-purple-600 dark:text-purple-400 border-purple-500/30"
                            >
                              Lead Gen
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Progress */}
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <div className="font-mono font-medium text-foreground">
                          {job.progress.collected} / {job.progress.limit} ads
                        </div>
                        {job.status === "running" && (
                          <div className="w-20 mt-1">
                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (job.progress.collected / job.progress.limit) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-3 align-top whitespace-nowrap font-mono text-muted-foreground">
                        {durationStr}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 align-top whitespace-nowrap text-muted-foreground">
                        <span title={formatDateTime(job.created_at)}>
                          {formatRelativeDate(job.created_at)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Results if available */}
                          {job.result_file && (
                            <Button
                              variant="outline"
                              size="icon-sm"
                              title="Ver resultados recolectados"
                              onClick={() =>
                                navigate(`/results/${encodeURIComponent(job.result_file!)}`)
                              }
                              className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          {/* View Job Live/Detail */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Ver seguimiento del trabajo"
                            onClick={() => navigate(`/jobs/${job.id}`)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          {/* Clone */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Clonar parámetros en nuevo scrape"
                            onClick={() => navigate(`/scrape/new?from=${job.id}`)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>

                          {/* Retry (if finished) */}
                          {isFinished && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Reintentar este trabajo"
                              onClick={() => handleRetry(job.id)}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          {/* Cancel (if active) */}
                          {isRunningOrWaiting && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Cancelar ejecución"
                              className="text-rose-500 hover:bg-rose-500/10"
                              onClick={() => setCancellingJobId(job.id)}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          {/* Delete (if finished) */}
                          {isFinished && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Eliminar trabajo del historial"
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(job.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
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

      {/* Cancel Confirmation Dialog */}
      <CancelJobDialog
        open={Boolean(cancellingJobId)}
        onOpenChange={(open) => {
          if (!open) setCancellingJobId(null);
        }}
        onConfirm={handleConfirmCancel}
        isCancelling={cancelJob.isPending}
      />
    </div>
  );
}
export default JobsPage;
