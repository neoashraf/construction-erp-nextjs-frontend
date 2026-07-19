import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Icon-circle tone for the empty-state glyph (design-system §5.3 semantics). */
const ICON_TONE = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
  destructive: "bg-destructive-soft text-destructive-ink",
  info: "bg-info-soft text-info-ink",
} as const;

/** Empty-state block (design-system §5.1; state matrix). Icon + message + optional CTA. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  iconTone = "neutral",
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  iconTone?: keyof typeof ICON_TONE;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-border-strong bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className={cn("mb-3 grid h-11 w-11 place-items-center rounded-full", ICON_TONE[iconTone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      ) : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
