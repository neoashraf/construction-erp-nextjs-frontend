"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfirmPasswordFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: string;
  /** Mirrors the new-password show/hide state (spec §5 — same masked/unmasked type). */
  showPassword: boolean;
}

/** Confirm new-password field (spec §7). Client-only value — never sent to the API. */
export function ConfirmPasswordField({ error, showPassword, ...rest }: ConfirmPasswordFieldProps) {
  return (
    <div className="mt-[14px] flex flex-col gap-[7px]">
      <Label
        htmlFor="cp-confirm"
        className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
      >
        Confirm new password
      </Label>
      <Input
        id="cp-confirm"
        type={showPassword ? "text" : "password"}
        autoComplete="new-password"
        placeholder="Re-enter the new password"
        invalid={!!error}
        aria-describedby={error ? "cp-confirm-error" : undefined}
        className="h-[42px] text-sm"
        {...rest}
      />
      {error && (
        <span
          id="cp-confirm-error"
          className="flex items-center gap-[6px] text-xs text-destructive-ink"
          data-testid="confirm-password-error"
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
    </div>
  );
}
