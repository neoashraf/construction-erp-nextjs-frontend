"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: string;
  showPassword: boolean;
  onToggleShow: () => void;
}

export function PasswordField({ error, showPassword, onToggleShow, ...rest }: PasswordFieldProps) {
  return (
    <div className="flex flex-col gap-[7px]">
      <Label
        htmlFor="login-password"
        className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
      >
        Password
      </Label>
      <div className="relative">
        <Input
          id="login-password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          invalid={!!error}
          className="h-[42px] pr-16 text-sm"
          {...rest}
        />
        <button
          type="button"
          onClick={onToggleShow}
          disabled={rest.disabled}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          className="absolute right-[7px] top-1/2 -translate-y-1/2 h-7 px-[9px] rounded-[6px] border-none bg-transparent text-[12px] font-semibold text-accent-ink transition-colors duration-[--dur-fast] hover:bg-accent-soft disabled:pointer-events-none"
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>
      {error && (
        <span className="text-xs text-destructive-ink" data-testid="password-error">
          {error}
        </span>
      )}
    </div>
  );
}
