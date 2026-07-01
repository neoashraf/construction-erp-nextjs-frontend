"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type PasswordStrength, type PolicyChecklistItem } from "../types";
import { StrengthMeter } from "./StrengthMeter";
import { PolicyChecklist } from "./PolicyChecklist";

interface NewPasswordFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: string;
  showPassword: boolean;
  onToggleShow: () => void;
  strength: PasswordStrength;
  checklist: PolicyChecklistItem[];
  /** Highlight unticked checklist items (after a blocked/failed submit — spec §6). */
  highlightUnmet?: boolean;
}

/**
 * New-password field (spec §5/§7): show/hide toggle + live strength meter +
 * live policy checklist, all client-side and advisory (server authoritative).
 */
export function NewPasswordField({
  error,
  showPassword,
  onToggleShow,
  strength,
  checklist,
  highlightUnmet = false,
  ...rest
}: NewPasswordFieldProps) {
  return (
    <div className="mt-[14px] flex flex-col gap-[7px]">
      <Label
        htmlFor="cp-new"
        className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
      >
        New password
      </Label>
      <div className="relative">
        <Input
          id="cp-new"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="At least 10 characters"
          invalid={!!error}
          aria-describedby={error ? "cp-new-error" : undefined}
          className="h-[42px] pr-16 text-sm"
          {...rest}
        />
        <button
          type="button"
          onClick={onToggleShow}
          disabled={rest.disabled}
          aria-label={showPassword ? "Hide new password" : "Show new password"}
          aria-pressed={showPassword}
          className="absolute right-[7px] top-1/2 h-7 -translate-y-1/2 rounded-[6px] border-none bg-transparent px-[9px] text-[12px] font-semibold text-accent-ink transition-colors duration-[--dur-fast] hover:bg-accent-soft disabled:pointer-events-none"
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>

      <StrengthMeter strength={strength} />

      {error && (
        <span
          id="cp-new-error"
          className="flex items-center gap-[6px] text-xs text-destructive-ink"
          data-testid="new-password-error"
        >
          <span
            aria-hidden="true"
            className="flex h-[13px] w-[13px] items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground"
          >
            !
          </span>
          {error}
        </span>
      )}

      <PolicyChecklist items={checklist} highlightUnmet={highlightUnmet} />
    </div>
  );
}
