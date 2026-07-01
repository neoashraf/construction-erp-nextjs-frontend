"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CurrentPasswordFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

/** Current-password field (spec §7). Focused on open (a11y §10). */
export function CurrentPasswordField({ error, inputRef, ...rest }: CurrentPasswordFieldProps) {
  return (
    <div className="mt-5 flex flex-col gap-[7px]">
      <Label
        htmlFor="cp-current"
        className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
      >
        Current password
      </Label>
      <Input
        id="cp-current"
        type="password"
        autoComplete="current-password"
        placeholder="Enter your current password"
        invalid={!!error}
        aria-describedby={error ? "cp-current-error" : undefined}
        className="h-[42px] text-sm"
        ref={inputRef}
        {...rest}
      />
      {error && (
        <span
          id="cp-current-error"
          className="flex items-center gap-[6px] text-xs text-destructive-ink"
          data-testid="current-password-error"
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
