import { cn } from "@/lib/utils";
import { type PolicyChecklistItem } from "../types";

interface PolicyChecklistProps {
  items: PolicyChecklistItem[];
  /** Highlight unmet items in destructive colour (after a blocked submit — spec §6/§8). */
  highlightUnmet?: boolean;
}

/**
 * Live policy checklist (spec §5/§6/§10 — SRS §16). Each row announces its
 * ticked/unticked state to assistive tech via `aria-checked` on a checkbox role,
 * not colour alone. No password-reuse/history row (SRS §16 — none in Phase 1).
 */
export function PolicyChecklist({ items, highlightUnmet = false }: PolicyChecklistProps) {
  return (
    <div className="mt-4 flex flex-col gap-2" data-testid="policy-checklist">
      {items.map((item) => (
        <div
          key={item.id}
          role="checkbox"
          aria-checked={item.met}
          aria-label={`${item.label}: ${item.met ? "met" : "not met"}`}
          className="flex items-center gap-[9px]"
          data-testid={`policy-item-${item.id}`}
          data-met={item.met}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-bold",
              item.met ? "bg-success-soft text-success-ink" : "bg-muted text-faint",
            )}
          >
            {item.met ? "✓" : "○"}
          </span>
          <span
            className={cn(
              "text-[12.5px]",
              item.met
                ? "text-success-ink"
                : highlightUnmet
                  ? "text-destructive-ink"
                  : "text-muted-foreground",
            )}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
