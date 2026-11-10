import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Play,
  Clock,
  Instagram,
  AlertTriangle,
  Info,
  Link as LinkIcon,
  Sliders,
  Calendar,
} from "lucide-react";
import { useHealth } from "@/api/queries/useHealth";
import type { ScrapeRequest, SearchMode } from "@/api/types";
import { scrapeFormSchema, type ScrapeFormValues } from "@/lib/schemas";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountrySelect } from "./CountrySelect";
import { CliPreview } from "./CliPreview";
import { cn } from "@/lib/cn";

interface ScrapeFormProps {
  initialValues?: Partial<ScrapeRequest>;
  onSubmit: (values: ScrapeRequest) => void | Promise<void>;
  isSubmitting?: boolean;
}

export function ScrapeForm({
  initialValues,
  onSubmit,
  isSubmitting = false,
}: ScrapeFormProps) {
  const { data: health } = useHealth();
  const hasActiveJob = Boolean(health?.active_job_id || (health?.queue_size ?? 0) > 0);

  const defaultValues: ScrapeFormValues = {
    mode: (initialValues?.mode as SearchMode) || "keyword",
    query: initialValues?.query || "",
    country: (initialValues?.country || "ALL").toUpperCase(),
    status: initialValues?.status || "active",
    platform: initialValues?.platform || null,
    media_type: initialValues?.media_type || "all",
    min_date: initialValues?.min_date || null,
    exact: Boolean(initialValues?.exact),
    only_ig_profile: Boolean(initialValues?.only_ig_profile),
    format: initialValues?.format || "csv",
    limit: initialValues?.limit || 50,
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<ScrapeFormValues>({
    resolver: zodResolver(scrapeFormSchema),
    defaultValues,
  });

  // Re-populate if initialValues change (e.g. from preset or clone)
  useEffect(() => {
    if (initialValues) {
      reset({
        ...defaultValues,
        ...initialValues,
        country: (initialValues.country || "ALL").toUpperCase(),
      });
    }
  }, [initialValues, reset]);

  const watchedValues = watch();
  const currentMode = watchedValues.mode;
  const currentQuery = watchedValues.query || "";
  const currentLimit = watchedValues.limit || 50;

  // Smart URL detection: user pasted a facebook URL in keyword or slug mode
  const isPastedFacebookUrl =
    currentMode !== "page_url" &&
    (currentQuery.toLowerCase().includes("facebook.com") ||
      currentQuery.toLowerCase().includes("fb.com"));

  const handleFormSubmit = (data: ScrapeFormValues) => {
    const payload: ScrapeRequest = {
      mode: data.mode,
      query: data.query,
      country: data.country,
      status: data.status,
      platform: data.platform || null,
      media_type: data.media_type,
      min_date: data.min_date || null,
      exact: data.mode === "keyword" ? Boolean(data.exact) : false,
      only_ig_profile: Boolean(data.only_ig_profile),
      format: data.format,
      limit: Number(data.limit),
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Search Mode Tabs */}
      <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            1. ¿Qué deseas buscar?
          </label>
          <Controller
            control={control}
            name="mode"
            render={({ field }) => (
              <Tabs
                value={field.value}
                onValueChange={(val) => field.onChange(val as SearchMode)}
                className="w-full"
              >
                <TabsList className="grid grid-cols-3 w-full max-w-md h-9">
                  <TabsTrigger value="keyword" className="text-xs">
                    Palabra clave
                  </TabsTrigger>
                  <TabsTrigger value="slug" className="text-xs">
                    Página (slug)
                  </TabsTrigger>
                  <TabsTrigger value="page_url" className="text-xs">
                    URL de página
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          />
        </div>

        {/* Query Input with dynamic mode help */}
        <div className="space-y-2">
          <div className="relative">
            <Input
              {...register("query")}
              placeholder={
                currentMode === "keyword"
                  ? "Ej: psicologo barcelona, clinica dental, b2b saas..."
                  : currentMode === "slug"
                  ? "Ej: nike, cocacola, stripe (sin facebook.com/)"
                  : "Ej: https://www.facebook.com/Nike"
              }
              className={cn("h-11 text-sm font-medium", errors.query && "border-rose-500")}
              autoFocus
            />
          </div>

          {errors.query && (
            <p className="text-xs text-rose-500 font-medium">{errors.query.message}</p>
          )}

          {/* Smart suggestion banner */}
          {isPastedFacebookUrl && (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs">
              <div className="flex items-center gap-2 text-primary font-medium">
                <LinkIcon className="w-4 h-4 shrink-0" />
                <span>Parece que has pegado una URL completa de Facebook.</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="default"
                className="h-7 text-xs"
                onClick={() => setValue("mode", "page_url")}
              >
                Cambiar a modo URL
              </Button>
            </div>
          )}

          {/* Exact phrase checkbox (only keyword mode) */}
          {currentMode === "keyword" && (
            <div className="flex items-center gap-2 pt-1">
              <Controller
                control={control}
                name="exact"
                render={({ field }) => (
                  <Checkbox
                    id="exact-match"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <label
                htmlFor="exact-match"
                className="text-xs text-muted-foreground select-none cursor-pointer"
              >
                Buscar como frase exacta entre comillas (ignora variaciones parciales)
              </label>
            </div>
          )}
        </div>
      </Card>

      {/* Filters Grid */}
      <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            2. Filtros de búsqueda
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Country */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">País</label>
            <Controller
              control={control}
              name="country"
              render={({ field }) => (
                <CountrySelect value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Estado</label>
            <Select {...register("status")}>
              <option value="active">Activos (En emisión)</option>
              <option value="inactive">Inactivos</option>
              <option value="all">Todos los estados</option>
            </Select>
          </div>

          {/* Platform */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Plataforma</label>
            <Controller
              control={control}
              name="platform"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value ? e.target.value : null)}
                >
                  <option value="">Todas las plataformas</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="messenger">Messenger</option>
                  <option value="audience_network">Audience Network</option>
                </Select>
              )}
            />
          </div>

          {/* Media Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Tipo de medio</label>
            <Select {...register("media_type")}>
              <option value="all">Todos los formatos</option>
              <option value="video">Vídeo</option>
              <option value="image">Imagen</option>
              <option value="memes">Memes</option>
              <option value="none">Sin medio</option>
            </Select>
          </div>
        </div>

        {/* Min Date */}
        <div className="pt-2 border-t border-border/50 max-w-xs">
          <label className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            Activos desde (fecha mínima)
          </label>
          <Input
            type="date"
            {...register("min_date")}
            max={new Date().toISOString().split("T")[0]}
            className="h-9 text-xs"
          />
          {errors.min_date && (
            <p className="text-xs text-rose-500 mt-1">{errors.min_date.message}</p>
          )}
        </div>
      </Card>

      {/* Lead Gen Mode Highlight Switch */}
      <Card
        className={cn(
          "p-4 border transition-all shadow-sm",
          watchedValues.only_ig_profile
            ? "bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-transparent border-purple-500/40 dark:border-purple-500/30"
            : "bg-card/60 border-border"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                watchedValues.only_ig_profile
                  ? "bg-gradient-to-tr from-amber-500 to-purple-600 text-white shadow-sm"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Instagram className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">
                  Modo Lead Gen (Solo perfiles de Instagram)
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  Prospección
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Descarta anuncios que conducen a sitios web externos o WhatsApp, y conserva
                únicamente aquellos que llevan a un perfil de Instagram (@usuario).
              </p>
              {watchedValues.only_ig_profile && (
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    El scraper inspeccionará entre 3× y 5× más anuncios hasta alcanzar los{" "}
                    {currentLimit} perfiles válidos solicitados.
                  </span>
                </div>
              )}
            </div>
          </div>

          <Controller
            control={control}
            name="only_ig_profile"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>
      </Card>

      {/* Execution Limits & Output Format */}
      <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Limit control */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Límite de anuncios válidos
              </label>
              <span className="text-sm font-bold font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                {currentLimit}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min={10}
                max={500}
                step={10}
                value={currentLimit}
                onChange={(e) => setValue("limit", Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <Input
                type="number"
                min={1}
                max={1000}
                {...register("limit", { valueAsNumber: true })}
                className="w-20 h-8 text-xs font-mono text-center shrink-0"
              />
            </div>

            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Recomendado: 50 – 200</span>
              {currentLimit > 200 && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Mayor riesgo de bloqueo
                </span>
              )}
            </div>
          </div>

          {/* Format selection */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Formato de exportación
            </label>
            <Controller
              control={control}
              name="format"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => field.onChange("csv")}
                    className={cn(
                      "p-2.5 rounded-lg border text-left transition-all",
                      field.value === "csv"
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <div className="text-xs font-semibold">CSV (Excel)</div>
                    <div className="text-[10px] opacity-80">UTF-8 con BOM compatible con Excel</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => field.onChange("json")}
                    className={cn(
                      "p-2.5 rounded-lg border text-left transition-all",
                      field.value === "json"
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <div className="text-xs font-semibold">JSON</div>
                    <div className="text-[10px] opacity-80">Estructurado para APIs y código</div>
                  </button>
                </div>
              )}
            />
          </div>
        </div>
      </Card>

      {/* Terminal CLI Live Preview */}
      <CliPreview request={watchedValues} />

      {/* Submit Action Bar */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-muted-foreground">
          {hasActiveJob ? (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
              <Clock className="w-4 h-4" />
              Hay un trabajo en ejecución. Se añadirá a la cola FIFO.
            </span>
          ) : (
            <span>El trabajo se ejecutará inmediatamente en segundo plano.</span>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="gap-2 px-8 font-semibold shadow-md"
        >
          {hasActiveJob ? (
            <>
              <Clock className="w-4 h-4" />
              <span>Añadir a la cola</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Lanzar scrape</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
