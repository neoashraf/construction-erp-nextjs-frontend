"use client";

import { Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney, toDecimal } from "@/lib/money";
import { type IndicativeRate } from "../hooks/useRequisitionOptions";
import { type ItemOption } from "../types";

export interface LineError {
  item?: string;
  qty?: string;
}

/** Derived line value string, or null while the rate is unresolved. */
export function lineValue(quantity: string, rate: string | null): string | null {
  if (rate == null || !quantity || !(Number(quantity) > 0)) return null;
  return toDecimal(quantity).times(toDecimal(rate)).toFixed(4);
}

/**
 * One material line as a stacked card (spec §4 mobile ≥360): Item picker, Requested qty,
 * UoM + indicative rate as read-only sub-text ("Calculating…" until resolved), derived line
 * value, Remove (disabled on the last remaining line). Used in the <lg card list.
 */
export function MaterialLineCard({
  index,
  itemId,
  quantity,
  rate,
  items,
  error,
  disabled,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  itemId: string;
  quantity: string;
  rate: IndicativeRate;
  items: ItemOption[];
  error?: LineError;
  disabled?: boolean;
  canRemove: boolean;
  onChange: (patch: { itemId?: string; requestedQuantity?: string }) => void;
  onRemove: () => void;
}) {
  const item = items.find((i) => i.id === itemId);
  const uom = item?.uom ?? "";
  const val = lineValue(quantity, rate.rate);

  return (
    <div className="rounded-card border border-border bg-surface p-3" data-testid="req-line-card">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`req-line-item-${index}`}>Item</Label>
        <Select id={`req-line-item-${index}`} value={itemId} disabled={disabled} invalid={!!error?.item} data-testid="req-line-item"
          onChange={(e) => onChange({ itemId: e.target.value })}>
          <option value="">Select an item…</option>
          {items.filter((i) => i.isActive || i.id === itemId).map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </Select>
        {error?.item && <p className="text-[12px] text-destructive-ink" role="alert">{error.item}</p>}
      </div>

      <div className="mt-2 flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`req-line-qty-${index}`}>Requested qty</Label>
          <Input id={`req-line-qty-${index}`} inputMode="decimal" value={quantity} disabled={disabled} invalid={!!error?.qty}
            className="font-mono tabular-nums" data-testid="req-line-qty" onChange={(e) => onChange({ requestedQuantity: e.target.value })} />
        </div>
        <div className="pb-2 text-[12px] text-muted-foreground">{uom || "—"}</div>
        {!disabled && (
          <button type="button" onClick={onRemove} disabled={!canRemove} aria-label="Remove line" data-testid="req-line-remove"
            className="mb-1 grid h-9 w-9 flex-none place-items-center rounded-token text-faint hover:bg-muted hover:text-destructive disabled:opacity-40">
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {error?.qty && <p className="mt-1 text-[12px] text-destructive-ink" role="alert">{error.qty}</p>}

      <div className="mt-2 flex items-center justify-between text-[12px]">
        <span className="text-faint">
          {rate.isLoading ? "Calculating…" : rate.rate != null ? `Rate ৳ ${formatMoney(rate.rate, { withSymbol: false })}` : "Rate —"}
        </span>
        <span className={cn("font-mono tabular-nums", val != null ? "text-foreground" : "text-faint")}>
          {val != null ? formatMoney(val) : "—"}
        </span>
      </div>
    </div>
  );
}
