"use client";

import { Plus, Trash2, Inbox } from "lucide-react";
import Decimal from "decimal.js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { PayableTypeBadge } from "./PayableTypeBadge";
import { exceedsRowCap, type AllocationRow } from "../schemas/payment.schema";

const GRID = "minmax(120px,1.5fr) 128px minmax(88px,1fr) minmax(88px,1fr) minmax(88px,1fr) minmax(112px,1.2fr) minmax(88px,1fr) 40px";
const money2 = (v: string) => formatMoney(v, { fractionDigits: 2 });
/** Applied = original − remaining outstanding (derived; no separate wire field). */
function appliedAmount(r: AllocationRow): string {
  try {
    return new Decimal(r.originalAmount).minus(new Decimal(r.remainingOutstanding)).toFixed(4);
  } catch {
    return "0.0000";
  }
}

/**
 * Allocation grid (spec §5 Allocation grid; FR-PAY-005/-006/-007/-008). Each row is
 * one open payable + an editable Amount input capped client-side to
 * `remainingOutstanding`. "Add payable" opens the picker; Remove strikes the row.
 */
export function AllocationGrid({
  rows,
  disabled,
  banner,
  onAdd,
  onChangeAmount,
  onRemove,
  showLabourTrueUp,
}: {
  rows: AllocationRow[];
  disabled: boolean;
  banner?: string;
  onAdd: () => void;
  onChangeAmount: (key: string, value: string) => void;
  onRemove: (key: string) => void;
  showLabourTrueUp: (row: AllocationRow) => React.ReactNode;
}) {
  return (
    <Card className="p-5" data-testid="payment-allocation-grid">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-token bg-primary text-[12px] font-bold text-primary-foreground">2</span>
        <h2 className="text-[14px] font-bold text-foreground">Allocation</h2>
        <span className="text-[11.5px] text-muted-foreground">· bill-wise against open, posted payables</span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={onAdd}
          disabled={disabled}
          data-testid="payment-allocation-add"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add payable
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="This party has no open payables to settle."
          description="Choose a different payee, or check that the bill/payable has been posted."
        />
      ) : (
        <div className="overflow-x-auto" data-testid="payment-allocation-list">
          <div style={{ minWidth: 820 }}>
            <div className="grid gap-2 border-b border-border pb-2 text-[12.5px]" style={{ gridTemplateColumns: GRID }}>
              <Th>Payable ref</Th>
              <Th>Type</Th>
              <Th align="right">Original ৳</Th>
              <Th align="right">Applied ৳</Th>
              <Th align="right">Outstanding ৳</Th>
              <Th align="right">Amount to allocate ৳</Th>
              <Th align="right">Accrued ৳</Th>
              <Th align="right" srLabel="Remove" />
            </div>
            {rows.map((r) => {
              const over = exceedsRowCap(r);
              return (
                <div key={r.key} data-testid={`payment-allocation-row-${r.payableId}`}>
                  <div className="grid items-start gap-2 border-b border-border py-3" style={{ gridTemplateColumns: GRID }}>
                    <span className="min-w-0 truncate font-mono font-semibold text-accent-ink" title={r.reference}>{r.reference}</span>
                    <span><PayableTypeBadge type={r.payableType} /></span>
                    <span className="text-right font-mono tabular-nums text-foreground">{money2(r.originalAmount)}</span>
                    <span className="text-right font-mono tabular-nums text-muted-foreground">{money2(appliedAmount(r))}</span>
                    <span className="text-right font-mono font-semibold tabular-nums text-foreground">{money2(r.remainingOutstanding)}</span>
                    <div className="flex flex-col items-end gap-1">
                      <MoneyInput
                        value={r.amountAllocated}
                        onChange={(e) => onChangeAmount(r.key, e.target.value)}
                        invalid={over}
                        disabled={disabled}
                        data-testid={`payment-allocation-amount-${r.payableId}`}
                        className="text-right"
                      />
                      {over && (
                        <p role="alert" className="text-[11.5px] font-medium text-destructive-ink" data-testid={`payment-allocation-over-${r.payableId}`}>
                          Exceeds outstanding.
                        </p>
                      )}
                    </div>
                    <span className={cn("text-right font-mono tabular-nums", r.accruedAmount ? "text-warning-ink" : "text-faint")}>
                      {r.accruedAmount ? money2(r.accruedAmount) : "—"}
                    </span>
                    <span className="flex justify-end">
                      <button
                        type="button"
                        aria-label={`Remove ${r.reference}`}
                        onClick={() => onRemove(r.key)}
                        disabled={disabled}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-token text-muted-foreground hover:bg-destructive-soft hover:text-destructive-ink disabled:opacity-60"
                        data-testid={`payment-allocation-remove-${r.payableId}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </span>
                  </div>
                  {r.payableType === "LABOUR_PAYABLE" && <div className="pb-3">{showLabourTrueUp(r)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {banner && (
        <p role="alert" className="mt-3 text-[12.5px] font-medium text-destructive-ink" data-testid="payment-allocation-banner">
          {banner}
        </p>
      )}
    </Card>
  );
}

function Th({ children, align = "left", srLabel }: { children?: React.ReactNode; align?: "left" | "right"; srLabel?: string }) {
  return (
    <span
      className={cn(
        "text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground",
        align === "right" && "text-right",
      )}
    >
      {srLabel ? <span className="sr-only">{srLabel}</span> : children}
    </span>
  );
}
