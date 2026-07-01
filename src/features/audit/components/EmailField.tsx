"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmailFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

export function EmailField({ error, inputRef, ...rest }: EmailFieldProps) {
  return (
    <div className="flex flex-col gap-[7px]">
      <Label
        htmlFor="login-email"
        className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
      >
        Email
      </Label>
      <Input
        id="login-email"
        type="email"
        autoComplete="username"
        placeholder="you@company.com"
        invalid={!!error}
        className="h-[42px] text-sm"
        ref={inputRef}
        {...rest}
      />
      {error && (
        <span className="text-xs text-destructive-ink" data-testid="email-error">
          {error}
        </span>
      )}
    </div>
  );
}
