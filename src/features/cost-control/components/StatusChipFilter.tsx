"use client";

import { cn } from "@/lib/utils";
import { ALERT_STATUSES, ALERT_STATUS_LABEL, type AlertStatus } from "../schemas/alerts.schema";

/**
 * Over / Approaching status chip filter (spec §5/§7/§10). Accessible toggle buttons
 * (`aria-pressed`) with visible labels + a severity dot (never colour-only). Both on by
 * default; unchecking the LAST active chip is blocked (a status-less alerts query is
 * meaningless) — the screen surfaces "Select at least one status." The chips cover only
 * `OVER`/`APPROACHING` — this screen is alerts-only (FR-CC-015).
 */
const DOT: Record<AlertStatus, string> = {
  OVER: "bg-destructive",
  APPROACHING: "bg-warning",
};

export function StatusChipFilter({
  value,
  onChange,
}: {
  value: readonly AlertStatus[];
  onChange: (next: AlertStatus[]) => void;
}) {
  function toggle(status: AlertStatus) {
    const checked = value.includes(status);
    // Block emptying the selection — keep at least one active (spec §7).
    if (checked && value.length === 1) return;
    onChange(checked ? value.filter((s) => s !== status) : [...value, status]);
  }

  return (
    <div role="group" aria-labelledby="alerts-status-label" className="flex flex-wrap gap-1.5" data-testid="alerts-status">
      {ALERT_STATUSES.map((s) => {
        const checked = value.includes(s);
        return (
          <button
            key={s}
            type="button"
            aria-pressed={checked}
            onClick={() => toggle(s)}
            data-testid={`alerts-status-${s}`}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:shadow-focus",
              checked
                ? "border-accent-soft bg-accent-soft text-accent-ink"
                : "border-border-strong bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", DOT[s])} aria-hidden />
            {ALERT_STATUS_LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}
