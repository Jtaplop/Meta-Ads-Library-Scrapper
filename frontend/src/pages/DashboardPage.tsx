import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Sparkles,
  Database,
  Instagram,
  Activity,
  ArrowRight,
  Plus,
  Layers,
  Clock,
} from "lucide-react";
import { useHealth } from "@/api/queries/useHealth";
import { useJobs, useJob } from "@/api/queries/useJobs";
import { useResults } from "@/api/queries/useResults";
import { useOptions } from "@/api/queries/useOptions";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { formatBytes, formatRelativeDate, formatDateTime } from "@/lib/format";

export function DashboardPage() {
  const navigate = useNavigate();

  const { data: health } = useHealth();
  const { data: jobsResponse } = useJobs({ limit: 10 });
  const { data: results = [] } = useResults();
  const { data: options } = useOptions();

  const activeJobId = health?.active_job_id;
  const { data: activeJob } = useJob(activeJobId);

  // Compute KPIs
  const totalScrapes = jobsResponse?.total ?? 0;

  const totalAdsCollected = useMemo(() => {
    return results.reduce((acc, r) => acc + (r.rows || 0), 0);
  }, [results]);

  const igProfilesFilesCount = useMemo(() => {
    return results.filter((r) => r.ig_profiles_only).length;
  }, [results]);

  const recentResults = useMemo(() => {
    return results.slice(0, 5);
  }, [results]);

  const recipes = options?.recipes || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <LayoutDashboard className="w-5 h-5 text-primary" />
            <span>Dashboard Principal</span>
          </div>
        }
        description="Resumen operativo del scraper, estado de la cola en vivo y acceso rápido a tus prospecciones de Meta Ads."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/scrape/batch")}
              className="gap-1.5 text-xs h-8"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Lote (Batch)</span>
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/scrape/new")}
              className="gap-1.5 text-xs h-8 font-semibold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo scrape</span>
            </Button>
          </div>
        }
      />

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <Card className="p-4 bg-card/80 border shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Scrapes Ejecutados
            </span>
            <div className="text-2xl font-bold font-mono text-foreground mt-1">
              {totalScrapes}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              consultas lanzadas
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
        </Card>

        {/* KPI 2 */}
        <Card className="p-4 bg-card/80 border shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Anuncios Recolectados
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {totalAdsCollected.toLocaleString("es-ES")}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              anuncios en disco
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
        </Card>

        {/* KPI 3 */}
        <Card className="p-4 bg-card/80 border shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Ficheros Lead Gen
            </span>
            <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
              {igProfilesFilesCount}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              con perfiles IG filtrados
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
            <Instagram className="w-5 h-5" />
          </div>
        </Card>

        {/* KPI 4 */}
        <Card className="p-4 bg-card/80 border shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Cola de Ejecución
            </span>
            <div className="text-sm font-semibold text-foreground mt-1">
              {activeJob ? (
                <span className="text-primary font-mono">1 activo</span>
              ) : (
                <span className="text-muted-foreground font-normal">Sin trabajos activos</span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              {health?.queue_size ?? 0} pendientes en cola
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Active Job Cockpit Card OR Quick CTA Banner */}
      {activeJob && ["running", "waiting"].includes(activeJob.status) ? (
        <Card className="p-5 border-primary/50 bg-primary/5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                Trabajo en ejecución ahora:
              </span>
              <span className="font-bold text-sm text-foreground">
                {activeJob.request.query}
              </span>
              <JobStatusBadge
                status={activeJob.status}
                waitRemainingSeconds={activeJob.progress.wait_remaining_seconds}
              />
            </div>

            <Button
              size="sm"
              onClick={() => navigate(`/jobs/${activeJob.id}`)}
              className="gap-1.5 h-7 text-xs font-semibold"
            >
              <span>Ver seguimiento en vivo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span>
                {activeJob.progress.collected} / {activeJob.progress.limit} anuncios
              </span>
              <span>
                {Math.min(
                  100,
                  Math.round((activeJob.progress.collected / activeJob.progress.limit) * 100)
                )}
                %
              </span>
            </div>
            <Progress
              value={Math.min(
                100,
                Math.round((activeJob.progress.collected / activeJob.progress.limit) * 100)
              )}
              className="h-2"
            />
          </div>
        </Card>
      ) : (
        <Card className="p-6 bg-gradient-to-r from-primary/10 via-background to-muted/40 border border-primary/20 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Inicia una nueva prospección de anunciantes</span>
            </h3>
            <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
              Extrae competidores o clientes potenciales en segundos. Selecciona palabras clave,
              países y filtra directamente perfiles de Instagram listos para contactar.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => navigate("/scrape/new")}
              className="gap-1.5 text-xs font-semibold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo scrape</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Recommended Recipes Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Recetas de acceso rápido
          </span>
          <Link to="/scrape/new" className="text-xs text-primary hover:underline font-medium">
            Ver todas →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {recipes.map((recipe) => (
            <Card
              key={recipe.id}
              onClick={() => {
                if (recipe.is_batch) {
                  navigate(`/scrape/batch`);
                } else {
                  navigate(`/scrape/new?recipe=${recipe.id}`);
                }
              }}
              className="p-3.5 bg-card hover:bg-accent/40 cursor-pointer border hover:border-primary/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-xs text-foreground">
                    {recipe.name || recipe.title}
                  </span>
                  {recipe.is_batch && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                      Batch
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {recipe.description}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{String(recipe.params.country ?? "ALL")}</span>
                <span className="font-semibold text-primary">Lanzar →</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Results Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Últimos resultados generados en disco
          </span>
          <Link to="/results" className="text-xs text-primary hover:underline font-medium">
            Ver todos los archivos ({results.length}) →
          </Link>
        </div>

        {recentResults.length === 0 ? (
          <Card className="p-8 text-center text-xs text-muted-foreground border-dashed">
            Todavía no hay archivos de resultados en la carpeta output.
          </Card>
        ) : (
          <Card className="border overflow-hidden shadow-sm bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted/50 border-b border-border/80 text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Búsqueda / Etiqueta</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Filas (Anuncios)</th>
                    <th className="py-2.5 px-3">Tamaño</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {recentResults.map((file) => (
                    <tr key={file.filename} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3">
                        <Link
                          to={`/results/${encodeURIComponent(file.filename)}`}
                          className="font-medium text-foreground hover:text-primary hover:underline truncate block max-w-xs"
                        >
                          {file.label}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-[10px] uppercase font-mono h-4">
                            {file.format}
                          </Badge>
                          {file.ig_profiles_only && (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-purple-600 dark:text-purple-400 border-purple-500/30 h-4"
                            >
                              IG Only
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium">
                        {file.rows !== null && file.rows !== undefined
                          ? `${file.rows} ads`
                          : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground font-mono">
                        {formatBytes(file.size_bytes)}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        <span title={formatDateTime(file.created_at)}>
                          {formatRelativeDate(file.created_at)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          to={`/results/${encodeURIComponent(file.filename)}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <span>Explorar</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
export default DashboardPage;
