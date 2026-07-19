"use client";

import { cn } from "@/lib/utils";
import { DimensionChip } from "./DimensionChip";

export interface DimensionOption {
  id: string;
  label: string;
}

/**
 * An editable posting-dimension chip (project · cost centre · purpose) in the movement
 * table's Dimensions column. Renders the design's chip (via `DimensionChip`) with a
 * **transparent native `<select>` laid over it** — so it looks read-only per the design
 * yet remains a real, keyboard- and screen-reader-operable form control that the test
 * suite drives by `data-testid` (`sj-out-project`, …) via `selectOptions`.
 *
 * `onCreate` (purpose only) adds a trailing "＋ New <label>…" option whose selection is
 * reported through `onRequestCreate` so the parent can open its inline-create input.
 */
export function DimensionSelectChip({
  value,
  displayLabel,
  fieldLabel,
  options,
  disabled,
  invalid,
  placeholderHint,
  testId,
  ariaLabel,
  allowCreate,
  onChange,
  onRequestCreate,
}: {
  /** Selected option id, or "". */
  value: string;
  /** The selected option's display text (for the filled chip). */
  displayLabel: string;
  /** Dimension name for the empty/required affordance. */
  fieldLabel: string;
  options: DimensionOption[];
  disabled?: boolean;
  invalid?: boolean;
  /** When set and no project is chosen yet, the select is disabled with this hint option. */
  placeholderHint?: string;
  testId: string;
  ariaLabel: string;
  allowCreate?: boolean;
  onChange: (id: string) => void;
  onRequestCreate?: () => void;
}) {
  const gated = !!placeholderHint;
  return (
    <span className="relative inline-flex max-w-full">
      <DimensionChip value={displayLabel} label={fieldLabel} invalid={invalid} />
      <select
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        data-testid={testId}
        disabled={disabled || gated}
        value={value}
        onChange={(e) => {
          if (e.target.value === "__new__") {
            onRequestCreate?.();
            return;
          }
          onChange(e.target.value);
        }}
        className={cn(
          "absolute inset-0 h-full w-full cursor-pointer rounded-token opacity-0",
          "focus-visible:opacity-100 focus-visible:shadow-focus disabled:cursor-not-allowed",
        )}
      >
        <option value="">{gated ? placeholderHint : `${fieldLabel}…`}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
        {allowCreate && !gated && <option value="__new__">＋ New {fieldLabel.toLowerCase()}…</option>}
      </select>
    </span>
  );
}
