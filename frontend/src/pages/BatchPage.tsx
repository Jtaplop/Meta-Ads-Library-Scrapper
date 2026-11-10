import { useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Layers,
  Clock,
  Play,
  ShieldAlert,
  Calendar,
  Instagram,
  CheckCircle2,
  Sliders,
  Ban,
  ArrowRight,
} from "lucide-react";
import { useCreateBatch, useBatch, useCancelBatch } from "@/api/queries/useBatches";
import { batchFormSchema, type BatchFormValues, parseBatchQueries } from "@/lib/schemas";
import type { BatchRequest, ScrapeRequest, SearchMode } from "@/api/types";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { CountrySelect } from "@/components/scrape/CountrySelect";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { formatDurationHuman } from "@/lib/format";
import { cn } from "@/lib/cn";

export function BatchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeBatchId = searchParams.get("id");

  const createBatch = useCreateBatch();
  const cancelBatch = useCancelBatch();
  const { data: batchDetail } = useBatch(activeBatchId);

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<BatchFormValues>({
    resolver: zodResolver(batchFormSchema),
    defaultValues: {
      queriesText: "ansiedad\nautoestima\nterapia online",
      pause_seconds: 150,
      country: "ES",
      status: "active",
      platform: null,
      media_type: "all",
      min_date: null,
      exact: false,
      only_ig_profile: true,
      format: "csv",
      limit: 50,
    },
  });

  const watchedValues = watch();
  const parsedQueries = useMemo(() => {
    return parseBatchQueries(watchedValues.queriesText || "");
  }, [watchedValues.queriesText]);

  // Duration calculation
  const estimatedSeconds = useMemo(() => {
    const n = parsedQueries.length;
    if (n === 0) return 0;
    const pause = watchedValues.pause_seconds || 0;
    // Assume ~45s average scraping per query
    return n * 45 + Math.max(0, n - 1) * pause;
  }, [parsedQueries.length, watchedValues.pause_seconds]);

  const handleLaunchBatch = async (data: BatchFormValues) => {
    const queries = parseBatchQueries(data.queriesText);
    if (queries.length === 0) {
      toast.error("Introduce al menos una búsqueda válida");
      return;
    }

    const baseRequest: ScrapeRequest = {
      mode: "keyword" as SearchMode,
      query: queries[0], // base placeholder
      country: data.country,
      status: data.status,
      platform: data.platform || null,
      media_type: data.media_type,
      min_date: data.min_date || null,
      exact: Boolean(data.exact),
      only_ig_profile: Boolean(data.only_ig_profile),
      format: data.format,
      limit: Number(data.limit),
    };

    const batchPayload: BatchRequest = {
      queries,
      base: baseRequest,
      pause_seconds: Number(data.pause_seconds),
    };

    try {
      const created = await createBatch.mutateAsync(batchPayload);
      toast.success(`Lote de ${queries.length} búsquedas creado con éxito`);
      setSearchParams({ id: created.id });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear el lote";
      toast.error(msg);
    }
  };

  const handleCancelBatch = async () => {
    if (!activeBatchId) return;
    try {
      await cancelBatch.mutateAsync(activeBatchId);
      toast.info("Lote cancelado");
    } catch {
      toast.error("No se pudo cancelar el lote");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-primary" />
            <span>Lote de Búsquedas (Batch)</span>
          </div>
        }
        description="Ejecuta secuencias de múltiples palabras clave de forma automatizada, aplicando pausas anti-bloqueo entre ejecuciones."
      />

      {/* If tracking an active batch */}
      {batchDetail && (
        <Card className="p-5 border-primary/40 bg-card/90 shadow-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Lote {batchDetail.id}</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary">
                  {batchDetail.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {batchDetail.completed_jobs} de {batchDetail.total_jobs} trabajos finalizados ·{" "}
                {batchDetail.total_collected} anuncios recolectados
              </p>
            </div>

            <div className="flex items-center gap-2">
              {batchDetail.status === "running" || batchDetail.status === "waiting" ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5 h-8 text-xs"
                  onClick={handleCancelBatch}
                  disabled={cancelBatch.isPending}
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Cancelar lote</span>
                </Button>
              ) : null}

              {batchDetail.status === "succeeded" || batchDetail.status === "completed" ? (
                <Button
                  size="sm"
                  className="gap-1.5 h-8 text-xs font-semibold"
                  onClick={() => navigate("/results")}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Explorar resultados</span>
                </Button>
              ) : null}
            </div>
          </div>

          {/* Aggregate Progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progreso del lote</span>
              <span>
                {Math.round(
                  batchDetail.total_limit > 0
                    ? (batchDetail.total_collected / batchDetail.total_limit) * 100
                    : 0
                )}
                %
              </span>
            </div>
            <Progress
              value={
                batchDetail.total_limit > 0
                  ? (batchDetail.total_collected / batchDetail.total_limit) * 100
                  : 0
              }
              className="h-2"
            />
          </div>

          {/* Jobs List in Batch */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Trabajos del lote:
            </span>
            <div className="divide-y divide-border/60 rounded-lg border bg-background overflow-hidden text-xs">
              {batchDetail.jobs.map((job, idx) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-2.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-muted-foreground text-[10px] w-4">
                      {idx + 1}.
                    </span>
                    <span className="font-medium text-foreground">{job.request.query}</span>
                    <JobStatusBadge
                      status={job.status}
                      waitRemainingSeconds={job.progress.wait_remaining_seconds}
                    />
                  </div>

                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>
                      {job.progress.collected} / {job.progress.limit} ads
                    </span>
                    <Link
                      to={`/jobs/${job.id}`}
                      className="text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>Ver</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* New Batch Creation Form */}
      <form onSubmit={handleSubmit(handleLaunchBatch)} className="space-y-6">
        {/* Multi-query Input Card */}
        <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              1. Búsquedas por línea (Una consulta por renglón)
            </label>
            <span className="text-xs text-primary font-medium">
              {parsedQueries.length} {parsedQueries.length === 1 ? "búsqueda" : "búsquedas únicas"}
            </span>
          </div>

          <textarea
            {...register("queriesText")}
            rows={5}
            placeholder="psicologo madrid&#10;clinica estetica barcelona&#10;entrenador personal online"
            className={cn(
              "w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              errors.queriesText && "border-rose-500"
            )}
          />

          {errors.queriesText && (
            <p className="text-xs text-rose-500">{errors.queriesText.message}</p>
          )}

          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="exact"
              render={({ field }) => (
                <Checkbox
                  id="batch-exact"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <label htmlFor="batch-exact" className="text-xs text-muted-foreground cursor-pointer">
              Buscar cada término como frase exacta
            </label>
          </div>
        </Card>

        {/* Anti-blocking Pause & Duration Estimation Card */}
        <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-foreground font-semibold text-xs uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>2. Configuración anti-bloqueo</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Pausa de seguridad entre ejecuciones (segundos)
              </label>
              <Input
                type="number"
                min={0}
                max={1800}
                {...register("pause_seconds", { valueAsNumber: true })}
                className="h-9 text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Recomendado: 150s (2.5 minutos). Permite que la sesión de Meta se enfríe y previene
                bloqueos temporales de IP.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-muted/40 border border-border/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>Tiempo total estimado</span>
              </div>
              <div className="text-base font-bold font-mono text-primary">
                ~{formatDurationHuman(estimatedSeconds)}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Calculado para {parsedQueries.length} consultas + pausas programadas.
              </p>
            </div>
          </div>
        </Card>

        {/* Common Filters Card */}
        <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              3. Filtros comunes para todas las búsquedas
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Country */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">País</label>
              <Controller
                control={control}
                name="country"
                render={({ field }) => (
                  <CountrySelect value={field.value} onChange={field.onChange} />
                )}
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Estado</label>
              <Select {...register("status")}>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
                <option value="all">Todos</option>
              </Select>
            </div>

            {/* Platform */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Plataforma</label>
              <Controller
                control={control}
                name="platform"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? e.target.value : null)}
                  >
                    <option value="">Todas las plataformas</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="messenger">Messenger</option>
                    <option value="audience_network">Audience Network</option>
                  </Select>
                )}
              />
            </div>

            {/* Media Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Tipo de medio</label>
              <Select {...register("media_type")}>
                <option value="all">Todos</option>
                <option value="video">Vídeo</option>
                <option value="image">Imagen</option>
                <option value="memes">Memes</option>
                <option value="none">Sin medio</option>
              </Select>
            </div>
          </div>

          {/* Min Date and Limit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/50">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Fecha mínima (Desde)
              </label>
              <Input
                type="date"
                {...register("min_date")}
                max={new Date().toISOString().split("T")[0]}
                className="h-9 text-xs max-w-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">
                Límite de anuncios por consulta
              </label>
              <Input
                type="number"
                min={1}
                max={500}
                {...register("limit", { valueAsNumber: true })}
                className="h-9 text-xs font-mono max-w-xs"
              />
            </div>
          </div>
        </Card>

        {/* Lead Gen Mode Switch */}
        <Card className="p-4 border bg-card/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Instagram className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-xs text-foreground block">
                Modo Lead Gen (Solo perfiles de Instagram)
              </span>
              <span className="text-[11px] text-muted-foreground">
                Descarta anuncios externos y conserva únicamente anunciantes con enlace a perfil IG.
              </span>
            </div>
          </div>
          <Controller
            control={control}
            name="only_ig_profile"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </Card>

        {/* Action Button */}
        <div className="flex items-center justify-end">
          <Button
            type="submit"
            size="lg"
            disabled={createBatch.isPending || parsedQueries.length === 0}
            className="gap-2 px-8 font-semibold shadow-md"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Lanzar lote ({parsedQueries.length} búsquedas)</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
export default BatchPage;
