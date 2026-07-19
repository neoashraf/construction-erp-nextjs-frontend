"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatusOption {
  value: string;
  label: string;
}

/**
 * Status multi-select (Purchase Orders / Bill / GRN filter bars — the design's STATUS
 * control renders the selected statuses as inline chips + a "+N" overflow with a ▾, opening
 * a checkbox menu of every status). Feature-local, mirroring the established
 * `audit/AuditFilterBar` multi-select idiom (the shared native `Select` can't render chips
 * or multi-select). Each option is a `role="checkbox"` button with a stable `data-testid`
 * and `aria-checked` for tests + screen readers. Selection is emitted as a `string[]`; the
 * caller joins it to the csv the contract's `status` query param accepts.
 */
export function StatusMultiSelect({
  options,
  selected,
  onChange,
  placeholder = "All statuses",
  labelledBy,
  testid = "status-multiselect",
}: {
  options: StatusOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  labelledBy?: string;
  testid?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocDown(ev: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) setOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(value: string) {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  }

  // The design shows one chip inline, then a "+N" overflow count.
  const VISIBLE = 1;
  const shown = selected.slice(0, VISIBLE);
  const overflow = selected.length - shown.length;
  const labelFor = (value: string) => options.find((o) => o.value === value)?.label ?? value;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-labelledby={labelledBy}
        onClick={() => setOpen((o) => !o)}
        data-testid={`${testid}-trigger`}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-1.5 rounded-token border bg-surface px-2.5 text-left transition-colors",
          "focus:outline-none focus:shadow-focus",
          open ? "border-accent shadow-focus" : "border-border-strong hover:bg-surface-2",
        )}
      >
        {selected.length === 0 ? (
          <span className="truncate text-sm text-faint">{placeholder}</span>
        ) : (
          <span className="flex min-w-0 items-center gap-1">
            {shown.map((value) => (
              <span
                key={value}
                className="inline-flex h-[21px] items-center gap-1 rounded-pill bg-accent-soft px-2 text-[11px] font-semibold text-accent-ink"
              >
                {labelFor(value)}
                {/* A span (not a button) so it can nest inside the trigger button — clicking
                    it removes the chip; the menu's "Clear statuses" is the keyboard path. */}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${labelFor(value)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(value);
                  }}
                  className="cursor-pointer text-accent-ink/70 hover:text-accent-ink"
                >
                  ×
                </span>
              </span>
            ))}
            {overflow > 0 && <span className="text-[11.5px] text-faint">+{overflow}</span>}
          </span>
        )}
        <ChevronDown className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div
          role="group"
          aria-labelledby={labelledBy}
          data-testid={testid}
          className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-full rounded-lg border border-border-strong bg-surface p-1.5 shadow-md"
        >
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(opt.value)}
                data-testid={`${testid}-${opt.value}`}
                className={cn(
                  "flex h-[34px] w-full items-center gap-2.5 rounded-token px-2 text-left outline-none transition-colors",
                  "hover:bg-muted focus-visible:bg-muted focus-visible:shadow-focus",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 flex-none items-center justify-center rounded-[5px] border",
                    checked ? "border-accent bg-accent text-white" : "border-border-strong",
                  )}
                  aria-hidden
                >
                  {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="text-[12.5px] font-medium text-foreground">{opt.label}</span>
              </button>
            );
          })}

          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              data-testid={`${testid}-clear`}
              className="mt-1 flex h-8 w-full items-center rounded-token border-t border-border px-2 pt-1 text-[12px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:shadow-focus"
            >
              Clear statuses
            </button>
          )}
        </div>
      )}
    </div>
  );
}
