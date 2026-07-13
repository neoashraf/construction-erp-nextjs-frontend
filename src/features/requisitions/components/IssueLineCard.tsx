"use client";

import { type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatQty, toDecimal } from "@/lib/money";
import { OnHandBadge } from "./OnHandBadge";
import { type GodownOption, type OnHand } from "../types";

/**
 * One issue line's editable state (shared by the desktop grid row + this mobile card). Quantity
 * is a `Decimal(18,4)` string bounded to `(0, balance]`; `godownId` defaults to the header
 * source and may be overridden per line. `error` is the inline per-line validation/server error.
 */
export interface IssueLineState {
  requisitionLineId: string;
  itemId: string;
  uom: string;
  balance: string;
  godownId: string;
  quantity: string;
  error: string | null;
}

/** A ± stepper for a `Decimal(18,4)` quantity, clamped to `[0, balance]` (spec §4 mobile). */
export function QtyStepper({
  value,
  balance,
  disabled,
  invalid,
  onChange,
  size = "md",
  testid,
}: {
  value: string;
  balance: string;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (v: string) => void;
  size?: "md" | "lg";
  testid?: string;
}) {
  function step(delta: number) {
    const cur = toDecimal(value.trim() === "" ? "0" : value.trim());
    let next = cur.plus(delta);
    if (next.lt(0)) next = toDecimal("0");
    const bal = toDecimal(balance);
    if (next.gt(bal)) next = bal;
    onChange(next.toFixed(4));
  }
  const btn = size === "lg" ? "h-11 w-12" : "h-9 w-10";
  return (
    <div
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-token border",
        invalid
          ? "border-destructive shadow-focus-error"
          : "border-border-strong focus-within:border-accent focus-within:shadow-focus",
        disabled && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={disabled}
        aria-label="Decrease quantity"
        className={cn(
          "grid flex-none place-items-center border-r border-border-strong bg-surface-2 text-muted-foreground hover:bg-muted disabled:cursor-not-allowed",
          btn,
        )}
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <input
        inputMode="decimal"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        data-testid={testid}
        className={cn(
          "w-full min-w-0 bg-background px-2 text-center font-mono text-[14px] tabular-nums text-foreground outline-none disabled:cursor-not-allowed disabled:bg-muted",
          size === "lg" && "text-[16px]",
        )}
      />
      <button
        type="button"
        onClick={() => step(1)}
        disabled={disabled}
        aria-label="Increase quantity"
        className={cn(
          "grid flex-none place-items-center border-l border-border-strong bg-surface-2 text-muted-foreground hover:bg-muted disabled:cursor-not-allowed",
          btn,
        )}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

/**
 * Mobile issue line card (spec §4 ≥360) — the highest-priority field layout: item + balance
 * prominent, source-godown picker, a large quantity stepper with an "Issue all" quick-fill, the
 * on-hand badge beneath, and the negative-stock warning/override slotted in when triggered.
 */
export function IssueLineCard({
  line,
  itemName,
  onHand,
  onHandLoading,
  insufficient,
  godowns,
  onChange,
  negativeSlot,
}: {
  line: IssueLineState;
  itemName: string;
  onHand: OnHand | null;
  onHandLoading: boolean;
  insufficient: boolean;
  godowns: GodownOption[];
  onChange: (patch: Partial<IssueLineState>) => void;
  negativeSlot?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-4"
      data-testid="req-issue-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-foreground [overflow-wrap:anywhere]">
            {itemName}
          </div>
          <div className="text-[12px] text-muted-foreground">
            Balance{" "}
            <span className="font-mono font-semibold text-warning-ink">
              {formatQty(line.balance, 4)}
            </span>{" "}
            {line.uom}
          </div>
        </div>
      </div>

      <Select
        value={line.godownId}
        onChange={(e) => onChange({ godownId: e.target.value })}
        aria-label="Source godown"
        data-testid="req-line-godown"
      >
        {godowns.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </Select>

      <div className="flex items-center gap-3">
        <QtyStepper
          value={line.quantity}
          balance={line.balance}
          disabled={onHandLoading}
          invalid={!!line.error}
          onChange={(v) => onChange({ quantity: v })}
          size="lg"
          testid="req-line-qty"
        />
        <button
          type="button"
          onClick={() => onChange({ quantity: toDecimal(line.balance).toFixed(4) })}
          disabled={onHandLoading}
          className="whitespace-nowrap text-[12.5px] font-semibold text-accent-ink hover:underline disabled:opacity-50"
          data-testid="req-issue-all"
        >
          Issue all
        </button>
      </div>

      <OnHandBadge
        onHand={onHand}
        uom={line.uom}
        loading={onHandLoading}
        insufficient={insufficient}
      />
      {line.error && (
        <p
          role="alert"
          className="text-[12px] font-medium text-destructive-ink"
          data-testid="req-line-error"
        >
          {line.error}
        </p>
      )}
      {negativeSlot}
    </div>
  );
}
