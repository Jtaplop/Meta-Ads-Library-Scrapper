import * as React from "react";
import { Columns3, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";

export interface ColumnDefinition {
  id: string;
  label: string;
  defaultVisible: boolean;
  required?: boolean;
}

export const ALL_COLUMNS: ColumnDefinition[] = [
  { id: "page_name", label: "Anunciante", defaultVisible: true, required: true },
  { id: "ig_username", label: "@usuario (IG)", defaultVisible: true },
  { id: "start_date", label: "Fecha inicio", defaultVisible: true },
  { id: "days_active", label: "Días activo", defaultVisible: true },
  { id: "landing_type", label: "Destino", defaultVisible: true },
  { id: "media", label: "Medio", defaultVisible: true },
  { id: "platforms", label: "Plataformas", defaultVisible: true },
  { id: "status", label: "Estado", defaultVisible: true },
  { id: "ad_text", label: "Texto / Copy", defaultVisible: true },
  { id: "ad_id", label: "ID Anuncio", defaultVisible: false },
  { id: "page_id", label: "ID Página", defaultVisible: false },
  { id: "ad_caption", label: "Titular", defaultVisible: false },
  { id: "end_date", label: "Fecha fin", defaultVisible: false },
  { id: "landing_page", label: "URL de destino", defaultVisible: false },
  { id: "snapshot_url", label: "Meta Snapshot URL", defaultVisible: false },
];

export interface ColumnPickerProps {
  visibleColumns: Record<string, boolean>;
  onChange: (visibleColumns: Record<string, boolean>) => void;
  className?: string;
}

export function ColumnPicker({
  visibleColumns,
  onChange,
  className,
}: ColumnPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close on click outside
  React.useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleToggle = (columnId: string) => {
    onChange({
      ...visibleColumns,
      [columnId]: !visibleColumns[columnId],
    });
  };

  const handleReset = () => {
    const defaults: Record<string, boolean> = {};
    for (const col of ALL_COLUMNS) {
      defaults[col.id] = col.defaultVisible;
    }
    onChange(defaults);
  };

  const activeCount = ALL_COLUMNS.filter(
    (col) => visibleColumns[col.id] ?? col.defaultVisible
  ).length;

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 gap-1.5 text-xs font-medium"
      >
        <Columns3 className="h-3.5 w-3.5 text-slate-500" />
        <span>Columnas</span>
        <span className="ml-0.5 rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-bold text-slate-600 dark:text-slate-300">
          {activeCount}
        </span>
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-40 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xl animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Visibilidad de Columnas
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {ALL_COLUMNS.map((col) => {
              const isChecked = visibleColumns[col.id] ?? col.defaultVisible;
              return (
                <label
                  key={col.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs cursor-pointer select-none transition-colors",
                    col.required
                      ? "opacity-60 cursor-not-allowed"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    disabled={col.required}
                    onCheckedChange={() => !col.required && handleToggle(col.id)}
                  />
                  <span className="text-slate-800 dark:text-slate-200 truncate">
                    {col.label}
                  </span>
                  {col.required && (
                    <span className="ml-auto text-[10px] text-slate-400">fija</span>
                  )}
                </label>
              );
            })}
          </div>

          <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Restablecer</span>
            </button>
            <span className="text-[11px] text-slate-400">
              {activeCount} de {ALL_COLUMNS.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
