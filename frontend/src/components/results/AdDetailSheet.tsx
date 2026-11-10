import * as React from "react";
import {
  Check,
  Code2,
  ExternalLink,
  Flame,
  Globe,
  Instagram,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { EnrichedAd } from "@/lib/enrich";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CopyButton } from "@/components/common/CopyButton";
import { LandingTypeBadge } from "./LandingTypeBadge";
import { MediaPreview } from "./MediaPreview";

export interface AdDetailSheetProps {
  ad: EnrichedAd | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdDetailSheet({ ad, open, onOpenChange }: AdDetailSheetProps) {
  const [copiedJson, setCopiedJson] = React.useState(false);

  if (!ad) return null;

  const isStatusActive = (ad.status ?? "").toUpperCase() === "ACTIVE";
  const cleanIgUser = ad.ig_username ? ad.ig_username.replace(/^@/, "").trim() : null;
  const igProfileUrl = cleanIgUser ? `https://www.instagram.com/${cleanIgUser}/` : null;

  const handleCopyJson = async () => {
    try {
      const jsonStr = JSON.stringify(ad, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      setCopiedJson(true);
      toast.success("JSON del anuncio copiado al portapapeles");
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      toast.error("No se pudo copiar el JSON");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl flex flex-col p-0 overflow-y-auto"
      >
        {/* Header */}
        <SheetHeader className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center gap-2">
            {isStatusActive ? (
              <Badge variant="success">Activo</Badge>
            ) : (
              <Badge variant="secondary">Inactivo</Badge>
            )}

            {ad.is_winner && (
              <Badge variant="winner" className="flex items-center gap-1">
                <Flame className="h-3 w-3 text-amber-500 fill-amber-500" />
                <span>Ganador ({ad.days_active ?? 30}+ días activo)</span>
              </Badge>
            )}

            {ad.ads_count && ad.ads_count > 1 && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                <span>{ad.ads_count} anuncios del anunciante</span>
              </Badge>
            )}
          </div>

          <div>
            <SheetTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{ad.page_name || "Anunciante sin nombre"}</span>
            </SheetTitle>
            {ad.page_id && (
              <SheetDescription className="font-mono text-xs text-slate-400 mt-0.5">
                Page ID: {ad.page_id}
              </SheetDescription>
            )}
          </div>
        </SheetHeader>

        {/* Content Body */}
        <div className="flex-1 p-6 space-y-6">
          {/* Quick Action Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 p-3 border border-slate-200/80 dark:border-slate-800">
            {/* Instagram Profile */}
            <div className="flex flex-col justify-center rounded-lg bg-white dark:bg-slate-900 p-2.5 shadow-2xs border border-slate-200/50 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
                <Instagram className="h-3 w-3 text-rose-500" />
                Perfil Instagram
              </span>
              {cleanIgUser ? (
                <div className="flex items-center justify-between gap-1">
                  <a
                    href={igProfileUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate font-semibold text-xs text-slate-900 dark:text-slate-100 hover:text-brand-500 transition-colors inline-flex items-center gap-1"
                    title={`Abrir @${cleanIgUser} en Instagram`}
                  >
                    <span>@{cleanIgUser}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                  </a>
                  <CopyButton
                    value={`@${cleanIgUser}`}
                    successMessage={`@${cleanIgUser} copiado`}
                    size="icon-sm"
                    className="h-6 w-6 shrink-0"
                  />
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">No disponible</span>
              )}
            </div>

            {/* Destination Landing */}
            <div className="flex flex-col justify-center rounded-lg bg-white dark:bg-slate-900 p-2.5 shadow-2xs border border-slate-200/50 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
                <Globe className="h-3 w-3 text-brand-500" />
                Destino / Funnel
              </span>
              <div className="flex items-center justify-between gap-1 overflow-hidden">
                <LandingTypeBadge
                  type={ad.landing_type}
                  domain={ad.landing_domain}
                  url={ad.landing_page}
                  showDomain
                />
                {ad.landing_page && (
                  <a
                    href={ad.landing_page}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon-sm" }),
                      "h-6 w-6 shrink-0 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                    title="Visitar URL de destino"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Ads Library Snapshot */}
            <div className="flex flex-col justify-center rounded-lg bg-white dark:bg-slate-900 p-2.5 shadow-2xs border border-slate-200/50 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Meta Ads Library
              </span>
              {ad.snapshot_url ? (
                <a
                  href={ad.snapshot_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-7 text-xs font-medium justify-between px-2"
                  )}
                >
                  <span className="truncate">Ver original</span>
                  <ExternalLink className="h-3 w-3 shrink-0 ml-1" />
                </a>
              ) : (
                <span className="text-xs text-slate-400 italic">Sin enlace directo</span>
              )}
            </div>
          </div>

          {/* Media Creative Preview */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Creativo Publicitario
            </h4>
            <MediaPreview
              videoUrl={ad.video_url}
              imageUrl={ad.image_url}
              snapshotUrl={ad.snapshot_url}
              pageName={ad.page_name}
            />
          </div>

          {/* Copy & Text */}
          <div className="space-y-4">
            {ad.ad_caption && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Título / Titular (Headline)
                  </h4>
                  <CopyButton
                    value={ad.ad_caption}
                    successMessage="Titular copiado"
                    size="icon-sm"
                    className="h-6 w-6"
                  />
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3.5 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {ad.ad_caption}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Texto del Anuncio (Copy Principal)
                </h4>
                {ad.ad_text && (
                  <CopyButton
                    value={ad.ad_text}
                    successMessage="Texto del anuncio copiado"
                    size="icon-sm"
                    className="h-6 w-6"
                  />
                )}
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap select-text max-h-[320px] overflow-y-auto">
                {ad.ad_text || (
                  <span className="italic text-slate-400">Sin texto de copy registrado</span>
                )}
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Detalles y Métricas Técnicas
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/30 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">ID del Anuncio</span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                  {ad.ad_id}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Fecha de Inicio</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {ad.start_date ? formatDateTime(ad.start_date, "d MMM yyyy") : "—"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Fecha de Fin</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {ad.end_date ? formatDateTime(ad.end_date, "d MMM yyyy") : "Activo actualmente"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Tiempo en Circulación</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {ad.days_active !== null ? `${ad.days_active} días` : "—"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Dominio Web</span>
                <span className="font-medium text-slate-900 dark:text-slate-100 truncate block">
                  {ad.landing_domain || "—"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Plataformas Meta</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {ad.platforms && ad.platforms.length > 0 ? (
                    ad.platforms.map((p) => (
                      <span
                        key={p}
                        className="rounded bg-slate-200/80 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-medium text-slate-700 dark:text-slate-300"
                      >
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 sm:justify-between items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyJson}
            className="w-full sm:w-auto text-xs flex items-center gap-1.5"
          >
            {copiedJson ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Code2 className="h-3.5 w-3.5 text-slate-500" />
            )}
            <span>Copiar JSON del anuncio</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-xs"
          >
            Cerrar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
