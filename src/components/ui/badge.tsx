import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Status / label badge (design-system §5.3). Tone carries meaning:
 * success = posted/paid · warning = draft/pending · destructive = overdue/error ·
 * neutral = reversed/closed · info · accent = brand. Optional leading dot.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      tone: {
        success: "bg-success-soft text-success-ink",
        warning: "bg-warning-soft text-warning-ink",
        destructive: "bg-destructive-soft text-destructive-ink",
        info: "bg-info-soft text-info-ink",
        accent: "bg-accent-soft text-accent-ink",
        neutral: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

const DOT: Record<BadgeTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  accent: "bg-accent",
  neutral: "bg-muted-foreground",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  const t: BadgeTone = tone ?? "neutral";
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", DOT[t])} aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Map a lifecycle/domain status string → badge tone (design-system §5.3). */
const STATUS_TONE: Record<string, BadgeTone> = {
  posted: "success", paid: "success", active: "success", balanced: "success", approved: "success",
  draft: "warning", pending: "warning", partial: "warning", submitted: "warning",
  overdue: "destructive", error: "destructive", rejected: "destructive", failed: "destructive",
  reversed: "neutral", cancelled: "neutral", closed: "neutral", inactive: "neutral",
  info: "info",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONE[status.toLowerCase()] ?? "neutral";
  const label = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  return (
    <Badge tone={tone} dot className={className}>
      {label}
    </Badge>
  );
}

export { badgeVariants };
