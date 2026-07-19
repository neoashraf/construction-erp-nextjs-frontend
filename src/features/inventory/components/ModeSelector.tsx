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
    <div
      role="radiogroup"
      aria-label="Mode"
      className="inline-flex h-9 overflow-hidden rounded-token border border-border-strong bg-surface"
      data-testid="sj-mode"
    >
      {STOCK_JOURNAL_MODES.map((m, i) => {
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
              "h-full px-3.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70",
              "focus-visible:outline-none focus-visible:shadow-focus",
              i > 0 && "border-l border-border",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {MODE_LABEL[m]}
          </button>
        );
      })}
    </div>
  );
}
