"use client";

import { cn } from "@/lib/utils";

/**
 * Pill toggle switch (Employees.dc.html statutory toggles). A labelled boolean —
 * dot slides right + track turns success-green when on. Keyboard-operable
 * (role=switch, space/enter), Bangla-safe label.
 */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex items-start gap-3", description ? "items-start" : "items-center")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-[34px] flex-none rounded-pill transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          checked ? "bg-success" : "bg-border-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-all",
            checked ? "right-0.5" : "left-0.5",
          )}
          aria-hidden
        />
      </button>
      <div className="min-w-0">
        <span className="text-[13.5px] font-medium text-foreground">{label}</span>
        {description && (
          <div className="mt-0.5 text-[11.5px] leading-snug text-faint">{description}</div>
        )}
      </div>
    </div>
  );
}
