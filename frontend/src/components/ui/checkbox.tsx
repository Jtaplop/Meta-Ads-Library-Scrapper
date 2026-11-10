import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  (
    {
      checked: controlledChecked,
      defaultChecked = false,
      onCheckedChange,
      disabled = false,
      className,
      id,
      name,
      ...props
    },
    ref
  ) => {
    const isControlled = controlledChecked !== undefined;
    const [uncontrolledChecked, setUncontrolledChecked] =
      React.useState(defaultChecked);
    const checked = isControlled ? controlledChecked : uncontrolledChecked;

    const toggle = () => {
      if (disabled) return;
      const next = !checked;
      if (!isControlled) {
        setUncontrolledChecked(next);
      }
      onCheckedChange?.(next);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggle();
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        id={id}
        name={name}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center",
          checked &&
            "bg-brand-600 text-white border-brand-600 dark:bg-brand-500 dark:border-brand-500",
          className
        )}
        {...props}
      >
        {checked && <Check className="h-3 w-3 stroke-[3]" />}
      </button>
    );
  }
);
Checkbox.displayName = "Checkbox";
