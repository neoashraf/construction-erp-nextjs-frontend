"use client";

import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Masked-bank display with a "Show"/"Hide" reveal (spec §8; NFR-002). Renders `•••• {last4}`
 * when masked, the full value when revealed. The reveal is a real `<button aria-pressed>` so
 * assistive tech announces the state (spec §10). The button itself is only rendered when the
 * caller passes `canReveal` — Accounts (read-only) sees masked-only. Reveal round-trips through
 * the server (`getEmployee({ reveal: true })`); the parent owns the revealed state + audit.
 */
export function MaskedBankField({
  label,
  value,
  masked,
  canReveal,
  isRevealed,
  onToggle,
  loading,
  testId,
}: {
  label: string;
  /** The value to render — masked (`•••• 7890`) when `masked=true`, else raw. */
  value: string | null;
  masked: boolean;
  canReveal: boolean;
  isRevealed: boolean;
  onToggle: () => void;
  loading?: boolean;
  testId?: string;
}) {
  const display = value ?? "—";
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-9 min-w-0 flex-1 items-center rounded-token border border-border-strong bg-muted px-3 font-mono text-sm text-foreground",
            "[overflow-wrap:anywhere]",
          )}
          data-testid={testId}
          data-masked={masked ? "true" : "false"}
        >
          {display}
        </span>
        {canReveal && (
          <button
            type="button"
            aria-pressed={isRevealed}
            aria-label={isRevealed ? `Hide ${label}` : `Show ${label}`}
            onClick={onToggle}
            disabled={loading}
            data-testid={testId ? `${testId}-toggle` : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-token border border-border-strong bg-surface px-3 text-[12.5px] font-semibold text-foreground",
              "transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {isRevealed ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
            {isRevealed ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </div>
  );
}
