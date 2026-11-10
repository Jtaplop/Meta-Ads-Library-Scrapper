import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  onBack?: () => void;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  onBack,
  className,
}: PageHeaderProps) {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      window.location.href = backHref;
    } else {
      window.history.back();
    }
  };

  const showBackButton = Boolean(onBack || backHref);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 pb-6 md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {showBackButton && (
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleBack}
            className="mt-0.5 shrink-0"
            aria-label="Volver atrás"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
      )}
    </div>
  );
}
