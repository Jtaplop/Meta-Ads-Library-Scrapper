import { AlertTriangle, Ban } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CancelJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isCancelling?: boolean;
}

export function CancelJobDialog({
  open,
  onOpenChange,
  onConfirm,
  isCancelling = false,
}: CancelJobDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-rose-500 mb-1">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <DialogTitle>¿Cancelar ejecución del scraper?</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-2">
            El scraper solo exporta los resultados a disco al finalizar la recolección
            satisfactoriamente. Si cancelas el trabajo en curso, se terminará el subproceso del
            navegador y <strong>se perderán los anuncios recolectados hasta el momento</strong>.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isCancelling}
          >
            Continuar ejecutando
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            disabled={isCancelling}
            className="gap-1.5"
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Sí, cancelar trabajo</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
