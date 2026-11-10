import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, error, disabled, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full appearance-none rounded-md border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-1 pr-8 text-sm text-slate-900 dark:text-slate-100 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-rose-500 focus-visible:ring-rose-500/50 focus-visible:border-rose-500",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
      </div>
    );
  }
);
Select.displayName = "Select";
