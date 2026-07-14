"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Toggle switch (design-system §5.1). A real `<button role="switch">` — keyboard
 * operable, `aria-checked` announced — styled as a sliding pill. Checked = success
 * (matches the design file's on-state green); unchecked = `border-strong`.
 */
export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
  "data-testid"?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onChange, disabled, id, ...aria }, ref) => (
    <button
      ref={ref}
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      {...aria}
      className={cn(
        "relative h-5 w-[34px] flex-none overflow-hidden rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-success" : "bg-border-strong",
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[14px]" : "translate-x-0",
        )}
      />
    </button>
  ),
);
Switch.displayName = "Switch";
