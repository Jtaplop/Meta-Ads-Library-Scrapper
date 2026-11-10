import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

export const progressVariants = cva(
  "h-full w-full flex-1 transition-all duration-300 ease-in-out",
  {
    variants: {
      variant: {
        default: "bg-brand-600 dark:bg-brand-500",
        warning: "bg-amber-500",
        success: "bg-emerald-500",
        danger: "bg-rose-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants> {
  value?: number | null;
  max?: number;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, variant = "default", ...props }, ref) => {
    const isIndeterminate = value === undefined || value === null;
    const clampedValue = Math.min(Math.max(value ?? 0, 0), max);
    const percentage = (clampedValue / max) * 100;

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={isIndeterminate ? undefined : Math.round(clampedValue)}
        className={cn(
          "relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800",
          className
        )}
        {...props}
      >
        {isIndeterminate ? (
          <div
            className={cn(
              progressVariants({ variant }),
              "w-1/3 animate-[indeterminate_1.5s_infinite_ease-in-out]"
            )}
          />
        ) : (
          <div
            className={progressVariants({ variant })}
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
    );
  }
);
Progress.displayName = "Progress";
