import { cn } from "@/lib/utils";
import { type NotificationSeverity } from "../types";

const LABEL: Record<NotificationSeverity, string> = {
  HIGH: "High",
  NORMAL: "Normal",
  LOW: "Low",
};

const CLASS: Record<NotificationSeverity, string> = {
  HIGH: "bg-destructive-soft text-destructive-ink",
  NORMAL: "bg-info-soft text-info-ink",
  LOW: "bg-muted text-muted-foreground",
};

const DOT: Record<NotificationSeverity, string> = {
  HIGH: "bg-destructive",
  NORMAL: "bg-info",
  LOW: "bg-muted-foreground",
};

/**
 * FE-53 — severity pill: a coloured dot + an uppercase text label (never
 * colour-alone) per spec §10. Matches the design file's inline pill (dot +
 * uppercase). Severity is presentation-only (FR-NTF-022); grants nothing.
 */
export function SeverityBadge({
  severity,
  className,
}: {
  severity: NotificationSeverity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        CLASS[severity],
        className,
      )}
      aria-label={`Severity: ${LABEL[severity]}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[severity])} aria-hidden />
      {LABEL[severity]}
    </span>
  );
}
