import { Check, Loader2, X, Circle } from "lucide-react";
import type { JobPhase, JobStatus } from "@/api/types";
import { cn } from "@/lib/cn";

interface PhaseStepperProps {
  phase?: JobPhase | null;
  status: JobStatus;
  className?: string;
}

interface Step {
  key: string;
  phases: JobPhase[];
  label: string;
}

const STEPS: Step[] = [
  { key: "starting", phases: ["starting", "browser"], label: "Lanzando" },
  { key: "navigating", phases: ["navigating"], label: "Navegando" },
  { key: "collecting", phases: ["collecting"], label: "Recolectando" },
  { key: "validating", phases: ["validating"], label: "Validando" },
  { key: "exporting", phases: ["exporting"], label: "Exportando" },
  { key: "finished", phases: ["finished"], label: "Hecho" },
];

export function PhaseStepper({ phase, status, className }: PhaseStepperProps) {
  const isFinalDone = status === "succeeded" || status === "empty";
  const isFailed = status === "failed";
  const isCancelled = status === "cancelled";

  // Find step index
  let currentStepIdx = -1;
  if (isFinalDone || phase === "finished") {
    currentStepIdx = 5;
  } else if (phase) {
    currentStepIdx = STEPS.findIndex((s) => s.phases.includes(phase));
  } else if (status === "running") {
    currentStepIdx = 0;
  }

  return (
    <div className={cn("w-full py-2 overflow-x-auto select-none", className)}>
      <div className="flex items-center justify-between min-w-[540px]">
        {STEPS.map((step, idx) => {
          const isPassed = isFinalDone || (currentStepIdx > idx && !isFailed && !isCancelled);
          const isCurrent = currentStepIdx === idx;
          const isLast = idx === STEPS.length - 1;

          let icon = <Circle className="w-2.5 h-2.5 fill-current text-muted-foreground/40" />;

          if (isPassed || (isCurrent && isFinalDone)) {
            icon = <Check className="w-3.5 h-3.5 text-white stroke-[3]" />;
          } else if (isCurrent) {
            if (isFailed) {
              icon = <X className="w-3.5 h-3.5 text-white stroke-[3]" />;
            } else if (isCancelled) {
              icon = <X className="w-3.5 h-3.5 text-white stroke-[3]" />;
            } else {
              icon = <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />;
            }
          }

          return (
            <div key={step.key} className="flex-1 flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all",
                    isPassed || (isCurrent && isFinalDone)
                      ? "bg-emerald-500 border-emerald-500 shadow-sm"
                      : isCurrent
                      ? isFailed
                        ? "bg-rose-500 border-rose-500 shadow-sm"
                        : isCancelled
                        ? "bg-zinc-500 border-zinc-500 shadow-sm"
                        : "bg-primary/10 border-primary ring-4 ring-primary/20"
                      : "bg-card border-border/80 text-muted-foreground"
                  )}
                >
                  {icon}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium mt-1.5 whitespace-nowrap",
                    isCurrent
                      ? "text-foreground font-semibold"
                      : isPassed
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 -mt-4 transition-colors",
                    currentStepIdx > idx || isFinalDone
                      ? "bg-emerald-500"
                      : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
