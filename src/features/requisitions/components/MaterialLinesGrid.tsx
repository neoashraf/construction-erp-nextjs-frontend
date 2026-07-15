"use client";

import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { MaterialLineCard, lineValue, type LineError } from "./MaterialLineCard";
import { OverBudgetBadge } from "./OverBudgetBadge";
import { OnHandBadge } from "./OnHandBadge";
import { type IndicativeRate, type OnHandResult } from "../hooks/useRequisitionOptions";
import { type BudgetStatus, type ItemOption } from "../types";

export interface LineDraft {
  itemId: string;
  requestedQuantity: string;
}

const GRID = "minmax(160px,1.6fr) 70px 110px 150px 110px 120px 40px";

/**
 * Material-lines grid (spec §4/§5): a full data-grid at ≥lg (Item · UoM · Requested qty ·
 * Indicative rate · Line value · Remove) and a stacked line-card list below lg. Indicative
 * rate + line value are read-only, server-derived ("Calculating…" until resolved). ≥1 line
 * required; Remove is disabled on the last remaining line. "Add line" appends a blank row.
 * Wrapped in its own card with a header bar (line count) and a footer estimated-total row,
 * matching the requested-items table pattern in the screen design.
 */
export function MaterialLinesGrid({
  lines,
  rates,
  onHand,
  items,
  errors,
  disabled,
  onLineChange,
  onAddLine,
  onRemoveLine,
  estimatedValue,
  estimating,
  budgetStatus,
}: {
  lines: LineDraft[];
  rates: IndicativeRate[];
  onHand?: OnHandResult[];
  items: ItemOption[];
  errors: LineError[];
  disabled?: boolean;
  onLineChange: (index: number, patch: Partial<LineDraft>) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  estimatedValue?: string | null;
  estimating?: boolean;
  budgetStatus?: BudgetStatus;
}) {
  const canRemove = lines.length > 1;

  return (
    <Card className="overflow-hidden" data-testid="req-lines">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-semibold text-foreground">Requested items</h2>
        <span className="inline-flex h-5 items-center rounded-pill bg-muted px-2 text-[11px] font-semibold text-muted-foreground">
          {lines.length} {lines.length === 1 ? "line" : "lines"}
        </span>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto gap-1.5 border-dashed text-accent-ink"
            onClick={onAddLine}
            data-testid="req-add-line"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add item
          </Button>
        )}
      </div>

      {/* ≥lg data-grid */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 720 }}>
          <div
            role="row"
            className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="py-2.5">Item</div>
            <div className="py-2.5">UoM</div>
            <div className="py-2.5 text-right">Requested qty</div>
            <div className="py-2.5">On-hand @ deliver</div>
            <div className="py-2.5 text-right">Indic. rate ৳</div>
            <div className="py-2.5 text-right">Line value ৳</div>
            <div className="py-2.5" />
          </div>
          {lines.map((l, i) => {
            const item = items.find((it) => it.id === l.itemId);
            const rate = rates[i] ?? { rate: null, isLoading: false };
            const stock = onHand?.[i] ?? { onHand: null, isLoading: false };
            const requestedQty = Number(l.requestedQuantity || 0);
            const insufficient = !!stock.onHand && requestedQty > Number(stock.onHand.quantityOnHand);
            const val = lineValue(l.requestedQuantity, rate.rate);
            const err = errors[i];
            return (
              <div key={i} className="border-b border-muted">
                <div className="grid items-center gap-2 px-3" style={{ gridTemplateColumns: GRID }}>
                  <div className="min-w-0 py-2">
                    <Select value={l.itemId} disabled={disabled} invalid={!!err?.item} aria-label={`Line ${i + 1} item`} data-testid="req-line-item"
                      onChange={(e) => onLineChange(i, { itemId: e.target.value })}>
                      <option value="">Select an item…</option>
                      {items.filter((it) => it.isActive || it.id === l.itemId).map((it) => (
                        <option key={it.id} value={it.id}>{it.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="py-2 text-[12.5px] text-muted-foreground">{item?.uom ?? "—"}</div>
                  <div className="py-2">
                    <Input inputMode="decimal" value={l.requestedQuantity} disabled={disabled} invalid={!!err?.qty}
                      className="text-right font-mono tabular-nums" aria-label={`Line ${i + 1} requested quantity`} data-testid="req-line-qty"
                      onChange={(e) => onLineChange(i, { requestedQuantity: e.target.value })} />
                  </div>
                  <div className="min-w-0 py-2">
                    {l.itemId ? (
                      <OnHandBadge onHand={stock.onHand} uom={item?.uom ?? ""} loading={stock.isLoading} insufficient={insufficient} />
                    ) : (
                      <span className="text-[12px] text-faint">—</span>
                    )}
                  </div>
                  <div className="py-2 text-right font-mono text-[12.5px] tabular-nums text-muted-foreground">
                    {rate.isLoading ? <span className="text-faint">Calculating…</span> : rate.rate != null ? formatMoney(rate.rate, { withSymbol: false }) : "—"}
                  </div>
                  <div className="py-2 text-right font-mono text-[12.5px] font-medium tabular-nums text-foreground">
                    {val != null ? formatMoney(val, { withSymbol: false }) : "—"}
                  </div>
                  <div className="flex justify-end py-2">
                    {!disabled && (
                      <button type="button" onClick={() => onRemoveLine(i)} disabled={!canRemove} aria-label={`Remove line ${i + 1}`} data-testid="req-line-remove"
                        className="grid h-8 w-8 place-items-center rounded-token text-faint hover:bg-muted hover:text-destructive disabled:opacity-40">
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
                {(err?.item || err?.qty) && (
                  <div className="px-3 pb-2 text-[12px] text-destructive-ink" role="alert">{err.item ?? err.qty}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* <lg card list */}
      <div className="flex flex-col gap-3 p-3 lg:hidden">
        {lines.map((l, i) => (
          <MaterialLineCard
            key={i}
            index={i}
            itemId={l.itemId}
            quantity={l.requestedQuantity}
            rate={rates[i] ?? { rate: null, isLoading: false }}
            onHand={onHand?.[i]}
            items={items}
            error={errors[i]}
            disabled={disabled}
            canRemove={canRemove}
            onChange={(patch) => onLineChange(i, patch)}
            onRemove={() => onRemoveLine(i)}
          />
        ))}
        {!disabled && (
          <Button type="button" variant="outline" size="md" className="w-full gap-1.5" onClick={onAddLine}>
            <Plus className="h-4 w-4" aria-hidden />
            Add line
          </Button>
        )}
      </div>

      {(estimatedValue !== undefined || estimating !== undefined) && (
        <div className="flex flex-wrap items-center justify-end gap-4 border-t border-border bg-surface-2 px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Estimated total</span>
          <span className="font-mono text-[16px] font-bold tabular-nums text-foreground">
            {estimating ? (
              <span className="text-faint" data-testid="req-estimating">Estimating…</span>
            ) : estimatedValue != null ? (
              formatMoney(estimatedValue)
            ) : (
              <span className="text-faint">—</span>
            )}
          </span>
          <OverBudgetBadge status={budgetStatus} />
        </div>
      )}
    </Card>
  );
}
