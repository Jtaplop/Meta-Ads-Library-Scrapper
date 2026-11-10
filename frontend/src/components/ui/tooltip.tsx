import * as React from "react";
import { cn } from "@/lib/cn";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement<{
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
  }>;
  delayMs?: number;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({
  content,
  children,
  delayMs = 200,
  className,
  side = "top",
}: TooltipProps) {
  const [visible, setVisible] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);

  const show = () => {
    timerRef.current = window.setTimeout(() => {
      setVisible(true);
    }, delayMs);
  };

  const hide = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  };

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const sideClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const childProps = children.props as {
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
  };

  const childWithEvents = React.cloneElement(children, {
    onMouseEnter: (e: React.MouseEvent) => {
      childProps.onMouseEnter?.(e);
      show();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      childProps.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e: React.FocusEvent) => {
      childProps.onFocus?.(e);
      show();
    },
    onBlur: (e: React.FocusEvent) => {
      childProps.onBlur?.(e);
      hide();
    },
  });

  return (
    <div className="relative inline-flex">
      {childWithEvents}
      {visible && content && (
        <div
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1 text-xs font-normal text-slate-100 shadow-md border border-slate-700/80 animate-in fade-in zoom-in-95",
            sideClasses[side],
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
