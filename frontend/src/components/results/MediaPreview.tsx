import * as React from "react";
import { AlertTriangle, ExternalLink, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface MediaPreviewProps {
  videoUrl?: string | null;
  imageUrl?: string | null;
  snapshotUrl?: string | null;
  pageName?: string | null;
  className?: string;
}

export function MediaPreview({
  videoUrl,
  imageUrl,
  snapshotUrl,
  pageName,
  className,
}: MediaPreviewProps) {
  const [hasError, setHasError] = React.useState(false);

  // Reset error when URLs change
  React.useEffect(() => {
    setHasError(false);
  }, [videoUrl, imageUrl]);

  const hasVideo = Boolean(videoUrl && videoUrl.trim().length > 0);
  const hasImage = Boolean(imageUrl && imageUrl.trim().length > 0);

  // Fallback card when Meta CDN URL has expired or failed to load
  if (hasError) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-amber-300 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-6 text-center shadow-xs",
          className
        )}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 mb-3 shadow-xs">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
          El enlace temporal del creativo en fbcdn.net ha caducado
        </h4>
        <p className="max-w-xs text-xs text-amber-700 dark:text-amber-400/90 mb-4">
          Meta invalida las URLs de sus CDNs tras unas horas. Puedes visualizar el anuncio activo en vivo directamente en la biblioteca oficial de Meta.
        </p>
        {snapshotUrl && (
          <a
            href={snapshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "border-amber-300 dark:border-amber-800 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 text-amber-900 dark:text-amber-200 inline-flex items-center gap-1.5"
            )}
          >
            <span>Ver anuncio original en Meta Ads Library</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    );
  }

  // Video creative
  if (hasVideo) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-black/90 aspect-video flex items-center justify-center",
          className
        )}
      >
        <video
          key={videoUrl}
          src={videoUrl!}
          controls
          preload="metadata"
          poster={imageUrl ?? undefined}
          onError={() => setHasError(true)}
          className="h-full w-full object-contain"
        >
          Tu navegador no soporta reproducción de vídeo HTML5.
        </video>
        <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
          <VideoIcon className="h-3 w-3" />
          <span>Vídeo</span>
        </div>
      </div>
    );
  }

  // Image creative
  if (hasImage) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 flex items-center justify-center min-h-[220px] max-h-[420px]",
          className
        )}
      >
        <img
          key={imageUrl}
          src={imageUrl!}
          alt={pageName ? `Creativo publicitario de ${pageName}` : "Creativo del anuncio"}
          loading="lazy"
          onError={() => setHasError(true)}
          className="h-full w-full object-contain max-h-[420px]"
        />
        <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
          <ImageIcon className="h-3 w-3" />
          <span>Imagen</span>
        </div>
      </div>
    );
  }

  // No creative URL available
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-6 text-center",
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-2">
        <ImageIcon className="h-5 w-5" />
      </div>
      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-3">
        Sin vista previa multimedia almacenada
      </p>
      {snapshotUrl && (
        <a
          href={snapshotUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "inline-flex items-center gap-1.5 text-xs"
          )}
        >
          <span>Ver anuncio original en Meta Ads Library</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
