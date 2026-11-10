import { Clock, Hourglass, Loader2, CheckCircle2, SearchX, XCircle, Ban } from "lucide-react";
import type { JobStatus } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

interface JobStatusBadgeProps {
  status: JobStatus;
  waitRemainingSeconds?: number | null;
  className?: string;
}

export function JobStatusBadge({
  status,
  waitRemainingSeconds,
  className,
}: JobStatusBadgeProps) {
  switch (status) {
    case "queued":
      return (
        <Badge
          variant="outline"
          className={cn("gap-1.5 bg-slate-500/10 text-slate-500 border-slate-500/20 font-medium", className)}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>En cola</span>
        </Badge>
      );

    case "waiting":
      return (
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-medium animate-pulse",
            className
          )}
        >
          <Hourglass className="w-3.5 h-3.5" />
          <span>
            {waitRemainingSeconds !== undefined && waitRemainingSeconds !== null
              ? `Pausa anti-bloqueo (${waitRemainingSeconds}s)`
              : "Pausa anti-bloqueo"}
          </span>
        </Badge>
      );

    case "running":
      return (
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5 bg-primary/15 text-primary border-primary/30 font-medium",
            className
          )}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Ejecutando</span>
        </Badge>
      );

    case "succeeded":
      return (
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium",
            className
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Completado</span>
        </Badge>
      );

    case "empty":
      return (
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5 bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30 font-medium",
            className
          )}
        >
          <SearchX className="w-3.5 h-3.5" />
          <span>Sin resultados</span>
        </Badge>
      );

    case "failed":
      return (
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-medium",
            className
          )}
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Fallido</span>
        </Badge>
      );

    case "cancelled":
      return (
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5 bg-zinc-500/15 text-zinc-500 border-zinc-500/20 font-medium",
            className
          )}
        >
          <Ban className="w-3.5 h-3.5" />
          <span>Cancelado</span>
        </Badge>
      );

    default:
      return (
        <Badge variant="outline" className={className}>
          <span>{status}</span>
        </Badge>
      );
  }
}
