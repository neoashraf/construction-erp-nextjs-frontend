"use client";

import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/money";
import { PayableTypeBadge } from "./PayableTypeBadge";
import { exceedsRowCap, type AllocationRow } from "../schemas/payment.schema";
import { Inbox } from "lucide-react";

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
        <span className="text-[11.5px] text-muted-foreground">Bill-wise · one row per payable</span>
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
          title="No allocations yet."
          description="Add one or more of the payee's open payables to allocate this payment."
        />
      ) : (
        <div className="grid grid-cols-[1.6fr_0.6fr_1fr_1fr_1.1fr_auto] gap-2 text-[12.5px]" data-testid="payment-allocation-list">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Payable ref</span>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Type</span>
          <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Original</span>
          <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Outstanding</span>
          <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Amount to allocate</span>
          <span />
          {rows.map((r) => {
            const over = exceedsRowCap(r);
            return (
              <div
                key={r.key}
                className="col-span-6 grid grid-cols-[1.6fr_0.6fr_1fr_1fr_1.1fr_auto] items-start gap-2 border-t border-border py-3"
                data-testid={`payment-allocation-row-${r.payableId}`}
              >
                <span className="font-mono font-semibold text-foreground [overflow-wrap:anywhere]">{r.reference}</span>
                <span><PayableTypeBadge type={r.payableType} /></span>
                <span className="text-right font-mono tabular-nums text-foreground">{formatMoney(r.originalAmount)}</span>
                <span className="text-right font-mono tabular-nums text-muted-foreground">{formatMoney(r.remainingOutstanding)}</span>
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
                    <p role="alert" className="text-[11.5px] font-medium text-destructive" data-testid={`payment-allocation-over-${r.payableId}`}>
                      Exceeds outstanding.
                    </p>
                  )}
                </div>
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
                {r.payableType === "LABOUR_PAYABLE" && (
                  <div className="col-span-6 mt-2">{showLabourTrueUp(r)}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {banner && (
        <p role="alert" className="mt-3 text-[12.5px] font-medium text-destructive" data-testid="payment-allocation-banner">
          {banner}
        </p>
      )}
    </Card>
  );
}
