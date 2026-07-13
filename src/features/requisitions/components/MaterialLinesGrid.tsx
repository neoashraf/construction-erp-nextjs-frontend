"use client";

import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { MaterialLineCard, lineValue, type LineError } from "./MaterialLineCard";
import { type IndicativeRate } from "../hooks/useRequisitionOptions";
import { type ItemOption } from "../types";

export interface LineDraft {
  itemId: string;
  requestedQuantity: string;
}

const GRID = "minmax(160px,1.8fr) 70px 120px 120px 130px 40px";

/**
 * Material-lines grid (spec §4/§5): a full data-grid at ≥lg (Item · UoM · Requested qty ·
 * Indicative rate · Line value · Remove) and a stacked line-card list below lg. Indicative
 * rate + line value are read-only, server-derived ("Calculating…" until resolved). ≥1 line
 * required; Remove is disabled on the last remaining line. "Add line" appends a blank row.
 */
export function MaterialLinesGrid({
  lines,
  rates,
  items,
  errors,
  disabled,
  onLineChange,
  onAddLine,
  onRemoveLine,
}: {
  lines: LineDraft[];
  rates: IndicativeRate[];
  items: ItemOption[];
  errors: LineError[];
  disabled?: boolean;
  onLineChange: (index: number, patch: Partial<LineDraft>) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
}) {
  const canRemove = lines.length > 1;

  return (
    <div data-testid="req-lines">
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
            <div className="py-2.5 text-right">Indic. rate ৳</div>
            <div className="py-2.5 text-right">Line value ৳</div>
            <div className="py-2.5" />
          </div>
          {lines.map((l, i) => {
            const item = items.find((it) => it.id === l.itemId);
            const rate = rates[i] ?? { rate: null, isLoading: false };
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
      <div className="flex flex-col gap-3 lg:hidden">
        {lines.map((l, i) => (
          <MaterialLineCard
            key={i}
            index={i}
            itemId={l.itemId}
            quantity={l.requestedQuantity}
            rate={rates[i] ?? { rate: null, isLoading: false }}
            items={items}
            error={errors[i]}
            disabled={disabled}
            canRemove={canRemove}
            onChange={(patch) => onLineChange(i, patch)}
            onRemove={() => onRemoveLine(i)}
          />
        ))}
      </div>

      {!disabled && (
        <Button type="button" variant="outline" size="md" className="mt-3 w-full gap-1.5 lg:w-auto" onClick={onAddLine} data-testid="req-add-line">
          <Plus className="h-4 w-4" aria-hidden />
          Add line
        </Button>
      )}
    </div>
  );
}
