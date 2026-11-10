import * as React from "react";
import {
  Calendar,
  Globe,
  Instagram,
  Link2,
  MessageCircle,
  Minus,
  Share2,
} from "lucide-react";
import type { LandingType } from "@/lib/enrich";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/tooltip";

export interface LandingTypeBadgeProps {
  type: LandingType;
  domain?: string | null;
  url?: string | null;
  showDomain?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

interface TypeConfig {
  label: string;
  icon: React.ElementType;
  classes: string;
}

const TYPE_CONFIG: Record<LandingType, TypeConfig> = {
  instagram: {
    label: "Instagram",
    icon: Instagram,
    classes:
      "bg-gradient-to-r from-rose-500 via-purple-500 to-amber-500 text-white font-semibold shadow-xs border-transparent",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    classes:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  calendly: {
    label: "Calendly",
    icon: Calendar,
    classes: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
  facebook: {
    label: "Facebook",
    icon: Share2,
    classes: "bg-sky-600/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  },
  linktree: {
    label: "Linktree",
    icon: Link2,
    classes: "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30",
  },
  web: {
    label: "Web",
    icon: Globe,
    classes:
      "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  },
  none: {
    label: "Sin enlace",
    icon: Minus,
    classes:
      "bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800",
  },
};

export function LandingTypeBadge({
  type,
  domain,
  url,
  showDomain = false,
  className,
  onClick,
}: LandingTypeBadgeProps) {
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.none;
  const Icon = config.icon;

  const displayText = showDomain && domain ? domain : config.label;
  const tooltipContent = url || domain || config.label;

  const badgeContent = (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors select-none",
        config.classes,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate max-w-[140px]">{displayText}</span>
    </span>
  );

  if (url || domain) {
    return (
      <Tooltip content={tooltipContent} side="top">
        {badgeContent}
      </Tooltip>
    );
  }

  return badgeContent;
}
