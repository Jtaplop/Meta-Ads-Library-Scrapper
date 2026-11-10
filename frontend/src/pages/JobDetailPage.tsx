import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle2,
  SearchX,
  XCircle,
  Ban,
  RotateCcw,
  Copy,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useJob, useCancelJob, useRetryJob } from "@/api/queries/useJobs";
import { useJobEvents } from "@/hooks/useJobEvents";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/ErrorState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { PhaseStepper } from "@/components/jobs/PhaseStepper";
import { ProgressPanel } from "@/components/jobs/ProgressPanel";
import { LogConsole } from "@/components/jobs/LogConsole";
import { CliPreview } from "@/components/scrape/CliPreview";
import { CancelJobDialog } from "@/components/jobs/CancelJobDialog";

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const { data: initialJob, isLoading: isLoadingInitial, error: initialError } = useJob(jobId);
  const cancelJob = useCancelJob();
  const retryJob = useRetryJob();

  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Live SSE connection and state
  const { job: liveJob, logs } = useJobEvents(jobId, initialJob);

  const currentJob = liveJob || initialJob;

  if (isLoadingInitial && !currentJob) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center text-muted-foreground text-xs">
        Cargando estado del trabajo...
      </div>
    );
  }

  if (initialError || !currentJob) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <ErrorState
          title="Trabajo no encontrado"
          message={`No pudimos localizar la ejecución con ID ${jobId}. Es posible que haya sido eliminada o que la URL sea incorrecta.`}
          action={
            <Button size="sm" onClick={() => navigate("/jobs")} className="text-xs">
              Volver al historial
            </Button>
          }
        />
      </div>
    );
  }

  const isRunningOrWaiting = ["running", "waiting", "queued"].includes(currentJob.status);
  const isFinished = ["succeeded", "empty", "failed", "cancelled"].includes(currentJob.status);

  const handleRetry = async () => {
    try {
      const newJob = await retryJob.mutateAsync(currentJob.id);
      toast.success("Nuevo trabajo encolado con los mismos parámetros");
      navigate(`/jobs/${newJob.id}`);
    } catch {
      toast.error("Error al reintentar el trabajo");
    }
  };

  const handleConfirmCancel = async () => {
    try {
      await cancelJob.mutateAsync(currentJob.id);
      toast.info("Trabajo cancelado");
    } catch {
      toast.error("Error al cancelar");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <PageHeader
        backHref="/jobs"
        title={
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="truncate">{currentJob.request.query}</span>
            <span className="text-xs font-mono text-muted-foreground font-normal">
              #{currentJob.id}
            </span>
            <JobStatusBadge
              status={currentJob.status}
              waitRemainingSeconds={currentJob.progress.wait_remaining_seconds}
            />
          </div>
        }
        description={
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="text-muted-foreground text-xs">Filtros:</span>
            <Badge variant="secondary" className="text-[10px] h-4 font-mono">
              {currentJob.request.country || "ALL"}
            </Badge>
            {currentJob.request.platform && (
              <Badge variant="outline" className="text-[10px] h-4">
                {currentJob.request.platform}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] h-4">
              {currentJob.request.media_type || "all"}
            </Badge>
            {currentJob.request.only_ig_profile && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 text-purple-600 dark:text-purple-400 border-purple-500/30"
              >
                Lead Gen
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] h-4">
              Límite: {currentJob.request.limit} ads
            </Badge>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {isRunningOrWaiting && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => setShowCancelDialog(true)}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => navigate(`/scrape/new?from=${currentJob.id}`)}
              title="Clonar parámetros en un nuevo scrape"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Clonar</span>
            </Button>

            {isFinished && (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={handleRetry}
                disabled={retryJob.isPending}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reintentar</span>
              </Button>
            )}
          </div>
        }
      />

      {/* 6-step visual pipeline */}
      <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm">
        <PhaseStepper phase={currentJob.phase} status={currentJob.status} />
      </Card>

      {/* Completion Contextual Banners */}
      {currentJob.status === "succeeded" && (
        <Card className="p-4 bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm">¡Scrape completado con éxito!</h4>
              <p className="text-xs opacity-90 mt-0.5">
                Se recolectaron y validaron{" "}
                <strong>{currentJob.progress.collected} anuncios</strong>. El archivo ya está listo
                para su análisis.
              </p>
            </div>
          </div>

          {currentJob.result_file && (
            <Button
              size="sm"
              onClick={() => navigate(`/results/${encodeURIComponent(currentJob.result_file!)}`)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 text-xs font-semibold shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Explorar resultados</span>
            </Button>
          )}
        </Card>
      )}

      {currentJob.status === "empty" && (
        <Card className="p-4 bg-muted/60 border border-border space-y-3">
          <div className="flex items-start gap-3">
            <SearchX className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm text-foreground">
                No se encontraron anuncios coincidentes
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Meta Ads Library respondió que ningún anuncio cumple los filtros exactos indicados.
              </p>
            </div>
          </div>

          <div className="bg-card rounded-lg p-3 border border-border/80 text-xs space-y-1.5">
            <div className="font-semibold text-muted-foreground uppercase text-[10px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Recomendaciones para obtener resultados:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px]">
              <li>
                <strong>Desactivar frase exacta:</strong> Las comillas restringen drásticamente las
                coincidencias de búsqueda en la biblioteca de Meta.
              </li>
              <li>
                <strong>Probar con país ALL:</strong> Si la marca no pauta activamente en el país
                seleccionado, no habrá resultados.
              </li>
              <li>
                <strong>Desactivar Modo Lead Gen:</strong> Si el anunciante envía tráfico a una página
                web o WhatsApp en lugar de a un perfil de Instagram.
              </li>
              <li>
                <strong>Ampliar o quitar fecha mínima:</strong> Permite descubrir anuncios más antiguos.
              </li>
            </ul>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
              onClick={() => navigate(`/scrape/new?from=${currentJob.id}`)}
            >
              <span>Ajustar parámetros y reintentar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {currentJob.status === "failed" && (
        <Card className="p-4 bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200 space-y-3">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-semibold text-sm">Falló la ejecución del scraper</h4>
              <p className="text-xs font-mono bg-rose-950/20 dark:bg-rose-950/40 p-2 rounded border border-rose-500/20">
                {currentJob.error || "Código de salida distinto de cero o excepción inesperada."}
              </p>
              <p className="text-[11px] text-muted-foreground pt-1">
                Sugerencia: Revisa los logs inferiores. Si persiste el error de navegación, verifica
                que Playwright esté instalado con <code>python -m playwright install chromium</code>.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5 text-xs font-semibold"
              onClick={handleRetry}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reintentar ahora</span>
            </Button>
          </div>
        </Card>
      )}

      {currentJob.status === "cancelled" && (
        <Card className="p-4 bg-muted/60 border border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Ban className="w-5 h-5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">
              Este trabajo fue cancelado manualmente antes de concluir la exportación.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5"
            onClick={handleRetry}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Relanzar</span>
          </Button>
        </Card>
      )}

      {/* Progress & Stat Cards Panel */}
      <ProgressPanel job={currentJob} />

      {/* CLI Equivalent Preview */}
      <CliPreview command={currentJob.command} request={currentJob.request} />

      {/* Real-time Log Console */}
      <LogConsole logs={logs} jobId={currentJob.id} />

      {/* Cancel Confirmation Dialog */}
      <CancelJobDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={handleConfirmCancel}
        isCancelling={cancelJob.isPending}
      />
    </div>
  );
}
export default JobDetailPage;
