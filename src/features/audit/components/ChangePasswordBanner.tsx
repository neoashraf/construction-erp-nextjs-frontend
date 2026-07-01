import { cn } from "@/lib/utils";
import { type ChangePasswordBannerVariant } from "../types";

const CONFIGS: Record<
  ChangePasswordBannerVariant,
  { role: "status" | "alert"; container: string; dot: string; ink: string; text: string }
> = {
  forced: {
    role: "status",
    container: "bg-info-soft border-info/40",
    dot: "bg-info",
    ink: "text-info-ink",
    text: "Required: choose a new password before you can use the app.",
  },
  success: {
    role: "alert",
    container: "bg-success-soft border-success/40",
    dot: "bg-success",
    ink: "text-success-ink",
    text: "Password updated. You'll be signed out of all devices.",
  },
  offline: {
    role: "alert",
    container: "bg-warning-soft border-warning/40",
    dot: "bg-warning",
    ink: "text-warning-ink",
    text: "Can't reach the server. Check your connection and try again.",
  },
};

interface ChangePasswordBannerProps {
  variant: ChangePasswordBannerVariant;
  "data-testid"?: string;
}

/**
 * Change-password banners (spec §6/§8/§9). "forced" is a `role="status"` info
 * banner (not an error); "success"/"offline" are `role="alert"` so assistive
 * tech announces them immediately (a11y §10).
 */
export function ChangePasswordBanner({ variant, "data-testid": testId }: ChangePasswordBannerProps) {
  const c = CONFIGS[variant];
  return (
    <div
      role={c.role}
      data-testid={testId ?? `change-password-banner-${variant}`}
      className={cn("flex items-start gap-[9px] rounded-[9px] border px-[13px] py-[11px]", c.container)}
    >
      <span className={cn("mt-[5px] h-[7px] w-[7px] flex-none rounded-full", c.dot)} aria-hidden="true" />
      <span className={cn("text-[13px] font-medium leading-[1.45]", c.ink)}>{c.text}</span>
    </div>
  );
}
