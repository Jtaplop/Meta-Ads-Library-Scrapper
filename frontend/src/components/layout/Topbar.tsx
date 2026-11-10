import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Sun, Moon, Menu, CheckCircle2, AlertTriangle } from "lucide-react";
import { useHealth } from "@/api/queries/useHealth";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  onToggleSidebar?: () => void;
}

export function Topbar({ onToggleSidebar }: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: health, isError } = useHealth();

  // Dark/light theme state
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return saved;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Derive human title from pathname
  const getPageTitle = (pathname: string) => {
    if (pathname === "/") return "Dashboard";
    if (pathname.startsWith("/scrape/new")) return "Nuevo Scrape";
    if (pathname.startsWith("/scrape/batch")) return "Lote de Búsquedas (Batch)";
    if (pathname === "/jobs") return "Historial de Trabajos";
    if (pathname.startsWith("/jobs/")) return "Detalle de Ejecución";
    if (pathname === "/results") return "Resultados Guardados";
    if (pathname.startsWith("/results/")) return "Explorador de Resultados";
    if (pathname.startsWith("/settings")) return "Ajustes y Configuración";
    return "Meta Ads Scraper";
  };

  const isConnected = !isError && health?.status === "ok";

  return (
    <header className="h-14 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between select-none">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onToggleSidebar}
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </Button>
        )}
        <h1 className="font-semibold text-base text-foreground tracking-tight">
          {getPageTitle(location.pathname)}
        </h1>
      </div>

      <div className="flex items-center gap-2.5">
        {/* API Health badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-background">
          {isConnected ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline text-muted-foreground">API conectada</span>
              <span className="sm:hidden text-emerald-500 font-semibold">OK</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              <span className="text-rose-500 font-medium">API desconectada</span>
            </>
          )}
        </div>

        {/* Quick New Scrape button */}
        <Button
          size="sm"
          className="gap-1.5 h-8 text-xs font-medium shadow-sm"
          onClick={() => navigate("/scrape/new")}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nuevo scrape</span>
          <kbd className="hidden md:inline-flex items-center justify-center text-[10px] bg-primary-foreground/20 text-primary-foreground px-1 py-0.2 rounded font-mono ml-0.5">
            N
          </kbd>
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={toggleTheme}
          title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-label="Alternar tema claro/oscuro"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>
    </header>
  );
}
