import { useEffect, useState } from "react";
import {
  ExternalLink,
  Hourglass,
  Layers,
  Instagram,
  AlertTriangle,
  RotateCcw,
  Clock,
} from "lucide-react";
import type { Job } from "@/api/types";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/cn";

interface ProgressPanelProps {
  job: Job;
  className?: string;
}

export function ProgressPanel({ job, className }: ProgressPanelProps) {
  const { progress, status, search_url, started_at, finished_at } = job;
  const isWaiting = status === "waiting";
  const isRunning = status === "running";

  // Calculate live elapsed seconds
  const [elapsed, setElapsed] = useState<number>(() => {
    if (!started_at) return 0;
    const start = new Date(started_at).getTime();
    const end = finished_at ? new Date(finished_at).getTime() : Date.now();
    return Math.max(0, Math.floor((end - start) / 1000));
  });

  useEffect(() => {
    if (!isRunning || !started_at || finished_at) return;

    const interval = setInterval(() => {
      const start = new Date(started_at).getTime();
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, started_at, finished_at]);

  const limit = progress.limit || 50;
  const collected = progress.collected || 0;
  const percent = Math.min(100, Math.round((collected / limit) * 100));

  const stagnantRatio =
    progress.stagnant_threshold && progress.stagnant_threshold > 0
      ? progress.stagnant / progress.stagnant_threshold
      : 0;
  const isStagnantWarning = stagnantRatio > 0.5;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Waiting banner */}
      {isWaiting && (
        <div className="flex items-center gap-3 p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
          <Hourglass className="w-5 h-5 shrink-0 animate-pulse text-amber-500" />
          <div className="text-xs">
            <span className="font-semibold">Pausa de seguridad anti-bloqueo activa:</span>{" "}
            Esperando{" "}
            <strong className="font-mono text-sm underline">
              {progress.wait_remaining_seconds ?? 0}s
            </strong>{" "}
            antes de lanzar la navegación para proteger tu IP y cuenta.
          </div>
        </div>
      )}

      {/* Main Progress Bar Card */}
      <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-sm">
              Recolectados {collected} / {limit} anuncios
            </span>
            <span className="text-muted-foreground font-mono">({percent}%)</span>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDuration(elapsed)}</span>
          </div>
        </div>

        <div aria-live="polite">
          <Progress
            value={isWaiting ? undefined : percent}
            className="h-2.5 transition-all"
          />
        </div>
      </Card>

      {/* 5 Stat Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Iteration */}
        <Card className="p-3 bg-card/80 border text-center flex flex-col justify-between">
          <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mb-1">
            <Layers className="w-3.5 h-3.5" />
            <span>Iteración</span>
          </div>
          <div className="font-mono font-bold text-base text-foreground">
            {progress.iteration} / {progress.max_iterations}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">scrolls ejecutados</span>
        </Card>

        {/* 2. Unique IG Profiles */}
        <Card className="p-3 bg-card/80 border text-center flex flex-col justify-between">
          <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mb-1">
            <Instagram className="w-3.5 h-3.5 text-purple-500" />
            <span>Perfiles IG</span>
          </div>
          <div className="font-mono font-bold text-base text-purple-600 dark:text-purple-400">
            {progress.unique_ig_profiles ?? 0}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">cuentas únicas</span>
        </Card>

        {/* 3. Stagnation with warning */}
        <Card
          className={cn(
            "p-3 border text-center flex flex-col justify-between transition-colors",
            isStagnantWarning
              ? "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400"
              : "bg-card/80"
          )}
        >
          <div className="flex items-center justify-center gap-1 text-[11px] mb-1">
            {isStagnantWarning ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <span className={isStagnantWarning ? "font-semibold" : "text-muted-foreground"}>
              Estancamiento
            </span>
          </div>
          <div className="font-mono font-bold text-base">
            {progress.stagnant} / {progress.stagnant_threshold ?? 20}
          </div>
          <span className="text-[10px] opacity-80 mt-1">
            {isStagnantWarning ? "Meta sin nuevos anuncios" : "intentos sin novedad"}
          </span>
        </Card>

        {/* 4. Retries */}
        <Card className="p-3 bg-card/80 border text-center flex flex-col justify-between">
          <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mb-1">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reintentos</span>
          </div>
          <div className="font-mono font-bold text-base text-foreground">
            {progress.retries}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">reconexiones</span>
        </Card>

        {/* 5. Search URL */}
        <Card className="p-3 bg-card/80 border text-center flex flex-col justify-between">
          <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mb-1">
            <ExternalLink className="w-3.5 h-3.5" />
            <span>URL de búsqueda</span>
          </div>
          <div className="mt-1">
            {search_url ? (
              <a
                href={search_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <span>Abrir en Meta</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-xs text-muted-foreground font-medium">Iniciando...</span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Ads Library</span>
        </Card>
      </div>
    </div>
  );
}
