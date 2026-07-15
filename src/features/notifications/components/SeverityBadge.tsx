import { AlertTriangle, Bell, Info } from "lucide-react";
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

/**
 * FE-53 — severity pill with icon + text label (never colour-alone) per spec §10.
 * Severity is presentation-only (FR-NTF-022); grants nothing.
 */
export function SeverityBadge({
  severity,
  className,
}: {
  severity: NotificationSeverity;
  className?: string;
}) {
  const Icon = severity === "HIGH" ? AlertTriangle : severity === "NORMAL" ? Bell : Info;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10.5px] font-semibold",
        CLASS[severity],
        className,
      )}
      aria-label={`Severity: ${LABEL[severity]}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {LABEL[severity]}
    </span>
  );
}
