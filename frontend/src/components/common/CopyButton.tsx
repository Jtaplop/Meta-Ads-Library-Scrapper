import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface CopyButtonProps extends Omit<ButtonProps, "onClick"> {
  value: string;
  successMessage?: string;
  showText?: boolean;
  copiedText?: string;
  defaultText?: string;
}

export function CopyButton({
  value,
  successMessage = "Copiado al portapapeles",
  showText = false,
  copiedText = "Copiado",
  defaultText = "Copiar",
  variant = "outline",
  size = "icon-sm",
  className,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = value;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={showText ? "sm" : size}
      onClick={handleCopy}
      className={cn("transition-all duration-150", className)}
      title="Copiar al portapapeles"
      aria-label="Copiar al portapapeles"
      {...props}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          {showText && <span>{copiedText}</span>}
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 text-slate-500" />
          {showText && <span>{defaultText}</span>}
        </>
      )}
    </Button>
  );
}
