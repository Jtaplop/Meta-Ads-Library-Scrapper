import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  detail?: string;
  onRetry?: () => void;
  className?: string;
  action?: React.ReactNode;
}

export function ErrorState({
  title = "Ha ocurrido un error inesperado",
  message = "No se pudieron cargar los datos. Comprueba la conexión con la API.",
  detail,
  onRetry,
  className,
  action,
}: ErrorStateProps) {
  const [showDetail, setShowDetail] = React.useState(false);

  return (
    <div
      className={cn(
        "flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/15 p-8 text-center",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 mb-3 shadow-xs">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-rose-900 dark:text-rose-200 mb-1">
        {title}
      </h3>
      <p className="max-w-md text-sm text-rose-700 dark:text-rose-400/90 mb-4">
        {message}
      </p>

      {detail && (
        <div className="mb-4 w-full max-w-md">
          <button
            type="button"
            onClick={() => setShowDetail(!showDetail)}
            className="text-xs text-rose-600 dark:text-rose-400 underline mb-2 cursor-pointer"
          >
            {showDetail ? "Ocultar detalles técnicos" : "Ver detalles técnicos"}
          </button>
          {showDetail && (
            <pre className="max-h-32 overflow-auto rounded-md bg-slate-900 p-2 text-left font-mono text-xs text-rose-300">
              {detail}
            </pre>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-2 border-rose-300 dark:border-rose-800 hover:bg-rose-100/50 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-300"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}
