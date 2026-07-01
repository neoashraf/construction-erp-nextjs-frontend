"use client";

import { cn } from "@/lib/utils";
import { type AuthBannerVariant } from "../types";

const CONFIGS: Record<
  AuthBannerVariant,
  { container: string; dot: string; ink: string; text: string }
> = {
  auth: {
    container: "bg-destructive-soft border-destructive/40",
    dot: "bg-destructive",
    ink: "text-destructive-ink",
    text: "Incorrect email or password.",
  },
  session: {
    container: "bg-info-soft border-info/40",
    dot: "bg-info",
    ink: "text-info-ink",
    text: "Your session has expired. Please sign in again.",
  },
  offline: {
    container: "bg-warning-soft border-warning/40",
    dot: "bg-warning",
    ink: "text-warning-ink",
    text: "Can't reach the server. Check your connection and try again.",
  },
};

interface AuthErrorBannerProps {
  variant: AuthBannerVariant;
  "data-testid"?: string;
}

export function AuthErrorBanner({ variant, "data-testid": testId }: AuthErrorBannerProps) {
  const c = CONFIGS[variant];
  return (
    <div
      role="alert"
      data-testid={testId ?? "auth-error-banner"}
      className={cn(
        "flex items-start gap-[9px] rounded-[9px] border px-[13px] py-[11px]",
        c.container,
      )}
    >
      <span
        className={cn("mt-[5px] h-[7px] w-[7px] flex-none rounded-full", c.dot)}
        aria-hidden="true"
      />
      <span className={cn("text-[13px] font-medium leading-[1.45]", c.ink)}>{c.text}</span>
    </div>
  );
}
