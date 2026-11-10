import { useState } from "react";
import { toast } from "sonner";
import {
  Settings,
  Server,
  Sliders,
  Bookmark,
  Moon,
  Sun,
  Bell,
  Trash2,
  Edit2,
  Info,
  Check,
} from "lucide-react";
import { useOptions } from "@/api/queries/useOptions";
import { useHealth } from "@/api/queries/useHealth";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { Preset } from "@/components/scrape/PresetMenu";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export function SettingsPage() {
  const { data: options } = useOptions();
  const { data: health } = useHealth();

  // Local preferences
  const [theme, setTheme] = useLocalStorage<"light" | "dark">("theme", "dark");
  const [winnerThreshold, setWinnerThreshold] = useLocalStorage<number>("winner_threshold_days", 30);
  const [browserNotifications, setBrowserNotifications] = useLocalStorage<boolean>(
    "browser_notifications",
    false
  );

  // Saved presets manager
  const [presets, setPresets] = useLocalStorage<Preset[]>("scrape_presets", []);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleToggleNotifications = async (enabled: boolean) => {
    if (enabled && typeof window !== "undefined" && "Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setBrowserNotifications(true);
        toast.success("Notificaciones del navegador activadas");
      } else {
        setBrowserNotifications(false);
        toast.error("Permiso de notificaciones denegado en tu navegador");
      }
    } else {
      setBrowserNotifications(enabled);
    }
  };

  const handleStartRename = (preset: Preset) => {
    setEditingPresetId(preset.id);
    setEditingName(preset.name);
  };

  const handleSaveRename = (presetId: string) => {
    if (!editingName.trim()) return;
    setPresets((prev) =>
      prev.map((p) => (p.id === presetId ? { ...p, name: editingName.trim() } : p))
    );
    setEditingPresetId(null);
    toast.success("Preset renombrado");
  };

  const handleDeletePreset = (presetId: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
    toast.info("Preset eliminado");
  };

  const handleClearAllPresets = () => {
    if (window.confirm("¿Seguro que deseas eliminar todos los presets guardados?")) {
      setPresets([]);
      toast.info("Todos los presets han sido eliminados");
    }
  };

  const backendConfig = options?.config || {};

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-primary" />
            <span>Ajustes y Configuración</span>
          </div>
        }
        description="Parámetros de ejecución del backend, preferencias locales y gestión de presets guardados."
      />

      {/* 1. Backend Read-only Configuration */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Configuración del Motor Backend (Solo Lectura)
            </span>
          </div>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            backend/config.py
          </Badge>
        </div>

        <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm divide-y divide-border/60">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            <div>
              <span className="text-[11px] text-muted-foreground block">Versión de la API</span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {health?.version || "1.0.0"} (Python {health?.python || "3.x"})
              </span>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block">Playwright Browser</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {health?.playwright_ok ? "Instalado y disponible" : "No detectado"}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block">Directorio de Salida</span>
              <span className="font-mono text-xs text-foreground truncate block max-w-xs" title={health?.output_dir}>
                {health?.output_dir || "backend/output"}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block">Modo Headless</span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {String(backendConfig.HEADLESS ?? true)}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block">Intentos máximos de Scroll</span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {String(backendConfig.MAX_SCROLL_ATTEMPTS ?? 50)}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block">Pausa de Scroll (segundos)</span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {String(backendConfig.SCROLL_PAUSE_MIN ?? 2.0)}s - {String(backendConfig.SCROLL_PAUSE_MAX ?? 4.0)}s
              </span>
            </div>
          </div>

          <div className="pt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="w-4 h-4 shrink-0 text-primary mt-0.5" />
            <span>
              Para modificar los timeouts de navegación, la visibilidad del navegador Chromium o los
              umbrales de estancamiento, edita el archivo <code>backend/config.py</code> o define
              variables de entorno con prefijo <code>MAS_</code>.
            </span>
          </div>
        </Card>
      </div>

      {/* 2. Local User Preferences */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Preferencias de la Interfaz Web
          </span>
        </div>

        <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">
            {/* Theme */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground block">
                Tema de la interfaz
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setTheme("light");
                    document.documentElement.classList.remove("dark");
                  }}
                  className="gap-1.5 text-xs h-8 flex-1"
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Claro</span>
                </Button>
                <Button
                  type="button"
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setTheme("dark");
                    document.documentElement.classList.add("dark");
                  }}
                  className="gap-1.5 text-xs h-8 flex-1"
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Oscuro</span>
                </Button>
              </div>
            </div>

            {/* Winner threshold */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground block">
                Umbral de "Anuncio Ganador" (días)
              </label>
              <Input
                type="number"
                min={1}
                max={365}
                value={winnerThreshold}
                onChange={(e) => setWinnerThreshold(Number(e.target.value) || 30)}
                className="h-8 text-xs font-mono max-w-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Anuncios activos por más de {winnerThreshold} días serán etiquetados como ganadores.
              </p>
            </div>

            {/* Notifications */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground block">
                Notificaciones del sistema
              </label>
              <div className="flex items-center justify-between p-2 rounded-lg border bg-background">
                <div className="flex items-center gap-2 text-xs">
                  <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Avisar al terminar scrape</span>
                </div>
                <Switch
                  checked={browserNotifications}
                  onCheckedChange={handleToggleNotifications}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 3. Saved Presets Manager */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Gestión de Presets Guardados ({presets.length})
            </span>
          </div>

          {presets.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAllPresets}
              className="text-xs text-destructive hover:bg-destructive/10 h-7"
            >
              Borrar todos
            </Button>
          )}
        </div>

        <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm">
          {presets.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No tienes presets guardados. Puedes guardar combinaciones frecuentes desde la pantalla
              de nuevo scrape.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1">
                    {editingPresetId === preset.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-7 text-xs w-56"
                          autoFocus
                        />
                        <Button
                          size="icon-sm"
                          onClick={() => handleSaveRename(preset.id)}
                          className="h-7 w-7"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">
                          {preset.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleStartRename(preset)}
                          className="h-5 w-5 text-muted-foreground"
                          title="Renombrar"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>País: {preset.values.country || "ALL"}</span>
                      <span>·</span>
                      <span>Estado: {preset.values.status || "active"}</span>
                      <span>·</span>
                      <span>Medio: {preset.values.media_type || "all"}</span>
                      <span>·</span>
                      <span>Límite: {preset.values.limit || 50} ads</span>
                      {preset.values.only_ig_profile && (
                        <>
                          <span>·</span>
                          <span className="text-purple-600 dark:text-purple-400 font-medium">
                            Solo IG
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePreset(preset.id)}
                    className="text-xs text-destructive hover:bg-destructive/10 h-7 self-end sm:self-center"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    <span>Eliminar</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
export default SettingsPage;
