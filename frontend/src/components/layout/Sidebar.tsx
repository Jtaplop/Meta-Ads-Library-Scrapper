import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  Layers,
  Activity,
  FolderArchive,
  Settings,
  Sparkles,
} from "lucide-react";
import { useHealth } from "@/api/queries/useHealth";
import { ActiveJobIndicator } from "./ActiveJobIndicator";
import { cn } from "@/lib/cn";

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const { data: health } = useHealth();
  const queueCount = health?.queue_size ?? 0;
  const hasActiveJob = Boolean(health?.active_job_id);

  const navItems = [
    {
      to: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
      end: true,
    },
    {
      to: "/scrape/new",
      label: "Nuevo scrape",
      icon: Search,
    },
    {
      to: "/scrape/batch",
      label: "Lote (Batch)",
      icon: Layers,
    },
    {
      to: "/jobs",
      label: "Trabajos",
      icon: Activity,
      badge: queueCount > 0 ? queueCount : hasActiveJob ? 1 : undefined,
    },
    {
      to: "/results",
      label: "Resultados",
      icon: FolderArchive,
    },
    {
      to: "/settings",
      label: "Ajustes",
      icon: Settings,
    },
  ];

  return (
    <aside
      className={cn(
        "w-64 border-r border-border bg-card flex flex-col justify-between h-full select-none",
        className
      )}
    >
      {/* Top brand header */}
      <div className="flex flex-col">
        <div className="h-14 border-b border-border px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight text-foreground">
                Meta Ads Scraper
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                Local Pro Tool
              </div>
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums",
                        isActive
                          ? "bg-primary-foreground text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom status and active job widget */}
      <div className="p-3 border-t border-border space-y-3 bg-muted/20">
        <ActiveJobIndicator />
      </div>
    </aside>
  );
}
