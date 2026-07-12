"use client";

import { AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Negative-stock warning + authorised override (spec §7/§8; FR-REQ-016; INV FR-INV-014/015).
 * Shown under an issue line whose quantity would take `(item, godown)` below zero. An
 * unauthorised actor sees only the warning (the server hard-stops with `NEGATIVE_STOCK_BLOCKED`);
 * an authorised actor gets the "Issue anyway (authorised)" toggle + a mandatory reason recorded
 * on the movement. Text always accompanies colour (§10). The `reason`/`enabled` state is
 * form-level (the API takes one `allowNegativeStock` + `negativeStockReason` per issue).
 */
export function NegativeStockOverride({
  itemName,
  godownName,
  canOverride,
  enabled,
  reason,
  error,
  onToggle,
  onReasonChange,
}: {
  itemName: string;
  godownName: string;
  canOverride: boolean;
  enabled: boolean;
  reason: string;
  error: string | null;
  onToggle: (on: boolean) => void;
  onReasonChange: (v: string) => void;
}) {
  return (
    <div
      className="flex flex-col gap-2.5 rounded-token border border-destructive-soft bg-destructive-soft px-4 py-3"
      data-testid="req-negstock"
    >
      <p className="flex items-start gap-2 text-[13px] font-medium text-destructive-ink">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-destructive" aria-hidden />
        This would take {itemName} below zero at {godownName}.
      </p>

      {canOverride ? (
        <>
          <label className="flex items-center gap-2.5" data-testid="req-negstock-toggle">
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => onToggle(!enabled)}
              className={cn(
                "relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors",
                enabled ? "bg-destructive" : "bg-border-strong",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-background transition-transform",
                  enabled ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </button>
            <span className="text-[13px] font-semibold text-destructive-ink">
              Issue anyway (authorised)
            </span>
            <span className="rounded-pill bg-background/70 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-destructive-ink">
              Negative-stock authority
            </span>
          </label>

          {enabled && (
            <div className="flex flex-col gap-1">
              <Textarea
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="Reason for issuing beyond on-hand stock…"
                invalid={!!error}
                rows={2}
                aria-required="true"
                aria-label="Reason for issuing beyond on-hand stock"
                className="bg-background"
                data-testid="req-negstock-reason"
              />
              {error ? (
                <p
                  role="alert"
                  className="text-[12px] font-medium text-destructive-ink"
                  data-testid="req-negstock-error"
                >
                  {error}
                </p>
              ) : (
                <p className="text-[11.5px] text-destructive-ink/80">
                  Reason for issuing beyond on-hand stock — recorded with the issue and the
                  negative-stock override.
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-[11.5px] text-destructive-ink/80">
          You can&apos;t issue beyond the stock on hand. Ask an authorised user, or wait for a stock
          top-up.
        </p>
      )}
    </div>
  );
}
