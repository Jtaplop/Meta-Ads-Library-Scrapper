import { Link } from "react-router-dom";
import { Loader2, Hourglass, ArrowRight } from "lucide-react";
import { useHealth } from "@/api/queries/useHealth";
import { useJob } from "@/api/queries/useJobs";
import { Progress } from "@/components/ui/progress";

export function ActiveJobIndicator() {
  const { data: health } = useHealth();
  const activeJobId = health?.active_job_id;
  const { data: job } = useJob(activeJobId);

  if (!activeJobId || !job || !["running", "waiting"].includes(job.status)) {
    return null;
  }

  const isWaiting = job.status === "waiting";
  const progressPercent = Math.min(
    100,
    job.progress.limit > 0 ? Math.round((job.progress.collected / job.progress.limit) * 100) : 0
  );

  return (
    <Link
      to={`/jobs/${job.id}`}
      className="block p-3 rounded-lg border border-border/80 bg-card/95 hover:bg-accent/40 transition-colors shadow-sm text-xs group"
    >
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1.5 font-medium truncate text-foreground">
          {isWaiting ? (
            <Hourglass className="w-3.5 h-3.5 text-amber-500 animate-pulse shrink-0" />
          ) : (
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
          )}
          <span className="truncate">{job.request.query}</span>
        </div>
        <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>

      <div className="space-y-1">
        <Progress value={isWaiting ? undefined : progressPercent} className="h-1.5" />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {isWaiting
              ? `Pausa: ${job.progress.wait_remaining_seconds ?? 0}s`
              : `${job.progress.collected} / ${job.progress.limit} ads`}
          </span>
          {!isWaiting && <span>{progressPercent}%</span>}
        </div>
      </div>
    </Link>
  );
}
