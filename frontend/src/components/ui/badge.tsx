import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors select-none",
  {
    variants: {
      variant: {
        default:
          "bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/30",
        secondary:
          "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
        outline:
          "border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300",
        success:
          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
        warning:
          "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30",
        danger:
          "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30",
        instagram:
          "bg-gradient-to-r from-rose-500 via-purple-500 to-amber-500 text-white font-semibold shadow-xs",
        winner:
          "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
