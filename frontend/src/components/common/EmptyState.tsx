import * as React from "react";
import { FolderSearch, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = FolderSearch,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 mb-4 shadow-xs">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
        {title}
      </h3>
      {description && (
        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400 mb-6">
          {description}
        </p>
      )}
      {action && <div className="flex items-center gap-3">{action}</div>}
    </div>
  );
}
