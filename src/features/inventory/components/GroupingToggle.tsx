"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { GROUP_BY_LABEL, LEDGER_GROUP_BY, type LedgerGroupBy } from "../schemas/stock-ledger.schema";

/**
 * "By godown" / "By item" grouping control (spec §5/§10). A proper `role="tablist"` —
 * arrow keys move + select, Home/End jump to the ends — because it re-sorts the same
 * fetched payload client-side (no refetch). Not colour-only: the active tab carries
 * `aria-selected` + a filled navy pill.
 */
export function GroupingToggle({
  value,
  onChange,
}: {
  value: LedgerGroupBy;
  onChange: (v: LedgerGroupBy) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next = index;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % LEDGER_GROUP_BY.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + LEDGER_GROUP_BY.length) % LEDGER_GROUP_BY.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = LEDGER_GROUP_BY.length - 1;
    else return;
    e.preventDefault();
    const target = LEDGER_GROUP_BY[next]!;
    onChange(target);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Group balances"
      className="inline-flex h-9 items-center gap-1 rounded-token border border-border-strong bg-surface p-1"
      data-testid="sl-grouping"
    >
      {LEDGER_GROUP_BY.map((mode, i) => {
        const active = mode === value;
        return (
          <button
            key={mode}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-testid={`sl-group-${mode}`}
            onClick={() => onChange(mode)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "h-7 rounded-[6px] px-3 text-[12.5px] font-semibold transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {GROUP_BY_LABEL[mode]}
          </button>
        );
      })}
    </div>
  );
}
