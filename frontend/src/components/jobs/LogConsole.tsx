import { useState, useRef, useEffect, useMemo } from "react";
import {
  Download,
  Search,
  Filter,
  ArrowDown,
  Terminal,
} from "lucide-react";
import type { LogEntry } from "@/api/types";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/common/CopyButton";
import { cn } from "@/lib/cn";

interface LogConsoleProps {
  logs: LogEntry[];
  jobId?: string;
  className?: string;
}

type LogLevel = "ALL" | "DEBUG" | "INFO" | "WARNING" | "ERROR";

export function LogConsole({ logs, jobId, className }: LogConsoleProps) {
  const [levelFilter, setLevelFilter] = useState<LogLevel>("ALL");
  const [searchText, setSearchText] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Level check
      if (levelFilter !== "ALL") {
        const entryLevel = log.level.toUpperCase();
        if (entryLevel !== levelFilter) {
          // Special case: WARN matches WARNING
          if (levelFilter === "WARNING" && (entryLevel === "WARN" || entryLevel === "WARNING")) {
            // matches
          } else {
            return false;
          }
        }
      }

      // Text query check
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        const inMessage = log.message.toLowerCase().includes(q);
        const inRaw = log.raw.toLowerCase().includes(q);
        if (!inMessage && !inRaw) return false;
      }

      return true;
    });
  }, [logs, levelFilter, searchText]);

  // Auto-scroll on new logs
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [filteredLogs.length, autoScroll]);

  // Full raw text for copy and download
  const fullRawText = useMemo(() => {
    return filteredLogs.map((l) => l.raw).join("\n");
  }, [filteredLogs]);

  const handleDownload = () => {
    const filename = jobId ? `job_${jobId}.log` : "scraper.log";
    const blob = new Blob([logs.map((l) => l.raw).join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-slate-950 text-slate-100 flex flex-col shadow-md overflow-hidden font-mono text-xs",
        className
      )}
    >
      {/* Console Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-400" />
          <span className="font-sans font-semibold text-slate-200">
            Terminal de Logs ({filteredLogs.length})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Level filter dropdown */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            <Filter className="w-3 h-3 text-slate-400" />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as LogLevel)}
              className="bg-transparent text-[11px] text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Todos los niveles</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar en logs..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded pl-6 pr-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-slate-600 w-32 sm:w-44"
            />
          </div>

          {/* Auto-scroll button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAutoScroll((prev) => !prev)}
            className={cn(
              "h-7 px-2 text-[11px] gap-1 border border-slate-800 hover:bg-slate-800",
              autoScroll ? "text-primary bg-primary/10" : "text-slate-400"
            )}
            title="Alternar auto-scroll"
          >
            <ArrowDown className="w-3 h-3" />
            <span>Auto-scroll</span>
          </Button>

          {/* Copy button */}
          <CopyButton
            value={fullRawText}
            successMessage="Logs copiados al portapapeles"
            showText
            className="h-7 text-[11px] border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
          />

          {/* Download button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 px-2 text-[11px] gap-1 text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800"
            title="Descargar archivo de log completo"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Descargar .log</span>
          </Button>
        </div>
      </div>

      {/* Log lines viewport */}
      <div
        ref={containerRef}
        role="log"
        aria-live="polite"
        className="p-3 overflow-y-auto max-h-[480px] min-h-[220px] font-mono text-[11px] leading-relaxed space-y-0.5 select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            {logs.length === 0
              ? "Esperando logs del proceso..."
              : "No hay líneas que coincidan con los filtros aplicados."}
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const level = log.level.toUpperCase();
            let levelClass = "text-slate-400";
            if (level === "INFO") levelClass = "text-emerald-400";
            else if (level === "DEBUG") levelClass = "text-sky-400/80";
            else if (level === "WARNING" || level === "WARN") levelClass = "text-amber-400";
            else if (level === "ERROR") levelClass = "text-rose-400 font-bold";

            return (
              <div key={`${log.seq}-${index}`} className="flex items-start gap-2 hover:bg-slate-900/60 py-0.5 px-1 rounded">
                <span className="text-slate-600 select-none shrink-0 w-8 text-right font-mono text-[10px]">
                  {log.seq}
                </span>
                <span className="text-slate-500 shrink-0 text-[10px] select-none">
                  {log.ts}
                </span>
                <span className={cn("shrink-0 font-bold w-14", levelClass)}>
                  {level.padEnd(7, " ")}
                </span>
                <span className="text-slate-200 break-all whitespace-pre-wrap flex-1">
                  {log.message || log.raw}
                </span>
              </div>
            );
          })
        )}
        <div ref={consoleEndRef} />
      </div>
    </div>
  );
}
