import { CheckCircle2, ArrowUpCircle, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ApprovalTier } from "../types";

/**
 * The **load-bearing** tier element (spec §4/§5; FR-REQ-009/-010). Two presentations:
 *  - `TierBanner` — the full-width banner that governs the screen's affordances and is
 *    announced first on load (`aria-live="polite"`, spec §10). Its `variant` mirrors the
 *    viewer's decision authority: in-tier (green, actionable) · escalated (amber, disabled) ·
 *    neutral (read-only / already-decided).
 *  - `TierPill` — the compact `TIER PM|ACCOUNTS` chip beside the estimated value.
 * Text + icon + tone, never colour alone (§10). Token-driven — no raw hex.
 */

type TierVariant = "in-tier" | "escalated" | "neutral";

const VARIANT: Record<
  TierVariant,
  { icon: LucideIcon; box: string; iconColor: string; title: string }
> = {
  "in-tier": {
    icon: CheckCircle2,
    box: "border-border bg-success-soft",
    iconColor: "text-success",
    title: "text-success-ink",
  },
  escalated: {
    icon: ArrowUpCircle,
    box: "border-border bg-warning-soft",
    iconColor: "text-warning",
    title: "text-warning-ink",
  },
  neutral: {
    icon: Info,
    box: "border-border bg-surface-2",
    iconColor: "text-muted-foreground",
    title: "text-foreground",
  },
};

export function TierBanner({
  variant,
  title,
  children,
  className,
}: {
  variant: TierVariant;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const v = VARIANT[variant];
  const Icon = v.icon;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={`req-tier-banner-${variant}`}
      className={cn("flex gap-3 rounded-card border p-4", v.box, className)}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 flex-none", v.iconColor)} aria-hidden />
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold", v.title)}>{title}</p>
        {children ? (
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {children}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Compact `TIER PM|ACCOUNTS` chip (spec §5). */
export function TierPill({ tier, className }: { tier: ApprovalTier; className?: string }) {
  return (
    <span
      data-testid={`req-tier-pill-${tier}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill bg-success-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.4px]",
        className,
      )}
    >
      <span className="text-success-ink/60">Tier</span>
      <span className="text-success-ink">{tier}</span>
    </span>
  );
}
