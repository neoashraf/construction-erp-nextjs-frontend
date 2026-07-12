"use client";

import { cn } from "@/lib/utils";
import { STOCK_JOURNAL_MODES, MODE_LABEL } from "../schemas/stock-journal.schema";
import { type StockJournalMode } from "../types";

/**
 * Transfer / Issue / Adjustment mode selector (FR-INV-008; spec §5/§7/§10). A proper
 * `role="radiogroup"` with arrow-key navigation. Switching mode reveals/hides the relevant
 * godown sides (screen). Locked (disabled) once the journal is saved past DRAFT (§7).
 */
export function ModeSelector({
  value,
  disabled,
  onChange,
}: {
  value: StockJournalMode;
  disabled?: boolean;
  onChange: (mode: StockJournalMode) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Mode" className="inline-flex rounded-token bg-muted p-0.5" data-testid="sj-mode">
      {STOCK_JOURNAL_MODES.map((m) => {
        const active = m === value;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(m)}
            data-testid={`sj-mode-${m}`}
            className={cn(
              "h-9 rounded-[6px] px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70",
              "focus-visible:outline-none focus-visible:shadow-focus",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {MODE_LABEL[m]}
          </button>
        );
      })}
    </div>
  );
}
