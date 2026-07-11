import { cn } from "@/lib/utils";
import { type BvaStatus } from "../types";

/**
 * Utilisation % with an inline progress bar (spec §5/§10). Fill is visually capped at
 * 100% with an overflow tick past it; the `aria-label` states the exact percentage so
 * the value never relies on the visual fill alone. Display rounding is cosmetic only —
 * the OK/APPROACHING/OVER classification always comes from the server `status`, never a
 * client re-round (spec §12). Shared across the CC read screens.
 */
const FILL: Record<BvaStatus, string> = {
  OK: "bg-success",
  APPROACHING: "bg-warning",
  OVER: "bg-destructive",
  UNBUDGETED: "bg-border-strong",
};

/** Trim an exact decimal-string percent ("92.5000") to a readable "92.5" for display. */
function displayPct(pct: string): string {
  const n = Number(pct);
  if (!Number.isFinite(n)) return pct;
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1)));
}

export function UtilisationBar({ pct, status }: { pct: string | null; status: BvaStatus }) {
  if (pct === null) {
    return <span className="text-faint">—</span>;
  }
  const n = Number(pct);
  const label = `${displayPct(pct)}%`;
  const fill = Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));
  const over = n > 100;
  return (
    <div className="flex items-center gap-2" aria-label={`${label} of budget used`} data-testid="cc-utilisation">
      <span className="w-[46px] flex-none text-right font-mono text-[12.5px] tabular-nums text-foreground">
        {label}
      </span>
      <div className="relative h-1.5 w-full min-w-[44px] overflow-hidden rounded-pill bg-muted" aria-hidden>
        <div className={cn("h-full rounded-pill", FILL[status])} style={{ width: `${fill}%` }} />
      </div>
      {over && (
        <span className="flex-none text-[11px] font-semibold text-destructive-ink" aria-hidden>
          ⚑
        </span>
      )}
    </div>
  );
}
