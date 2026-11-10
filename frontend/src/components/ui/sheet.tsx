import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface SheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: SheetProps) {
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  return (
    <SheetContext.Provider value={{ open, setOpen: handleOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
}

export function SheetTrigger({
  children,
  asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const context = React.useContext(SheetContext);
  if (!context) throw new Error("SheetTrigger must be used within Sheet");

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    props.onClick?.(e);
    context.setOpen(true);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void }>, {
      onClick: handleClick,
    });
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

const sheetVariants = cva(
  "fixed z-50 bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 p-6 shadow-2xl transition ease-in-out duration-300 overflow-y-auto",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b border-slate-200 dark:border-slate-800 animate-in slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r border-slate-200 dark:border-slate-800 sm:max-w-md animate-in slide-in-from-left",
        right:
          "inset-y-0 right-0 h-full w-full border-l border-slate-200 dark:border-slate-800 sm:max-w-xl animate-in slide-in-from-right",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
);

export interface SheetContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sheetVariants> {
  onClose?: () => void;
}

export function SheetContent({
  side = "right",
  className,
  children,
  onClose,
  ...props
}: SheetContentProps) {
  const context = React.useContext(SheetContext);
  if (!context) throw new Error("SheetContent must be used within Sheet");

  const close = () => {
    onClose?.();
    context.setOpen(false);
  };

  React.useEffect(() => {
    if (!context.open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [context.open]);

  if (!context.open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={close}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="Cerrar panel"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-2 text-left", className)}
      {...props}
    />
  );
}

export function SheetTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-lg font-semibold text-slate-900 dark:text-slate-100", className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-slate-500 dark:text-slate-400", className)}
      {...props}
    />
  );
}

export function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-6 border-t border-slate-100 dark:border-slate-800/80 mt-6",
        className
      )}
      {...props}
    />
  );
}

export function SheetClose({
  children,
  asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const context = React.useContext(SheetContext);
  if (!context) throw new Error("SheetClose must be used within Sheet");

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    props.onClick?.(e);
    context.setOpen(false);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void }>, {
      onClick: handleClick,
    });
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}
