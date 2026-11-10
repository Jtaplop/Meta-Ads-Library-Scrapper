import { Terminal } from "lucide-react";
import type { ScrapeRequest } from "@/api/types";
import { buildCliPreview } from "@/lib/cliPreview";
import { CopyButton } from "@/components/common/CopyButton";
import { cn } from "@/lib/cn";

interface CliPreviewProps {
  request?: Partial<ScrapeRequest>;
  command?: string | string[];
  className?: string;
}

export function CliPreview({ request, command, className }: CliPreviewProps) {
  let commandStr = "";

  if (command) {
    commandStr = Array.isArray(command) ? command.join(" ") : command;
  } else if (request) {
    commandStr = buildCliPreview(request);
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-slate-950 text-slate-100 overflow-hidden shadow-sm font-mono text-xs",
        className
      )}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2 text-slate-400">
          <Terminal className="w-3.5 h-3.5" />
          <span className="text-[11px] font-sans font-medium text-slate-300">
            Comando CLI equivalente
          </span>
        </div>
        <CopyButton
          value={commandStr}
          successMessage="Comando CLI copiado"
          className="h-6 px-2 text-[10px] text-slate-300 hover:text-white border-slate-700 hover:bg-slate-800"
          showText
        />
      </div>

      <div className="p-3 overflow-x-auto select-all text-slate-200 whitespace-pre font-mono leading-relaxed">
        <span className="text-emerald-400 select-none mr-2">$</span>
        {commandStr}
      </div>
    </div>
  );
}
