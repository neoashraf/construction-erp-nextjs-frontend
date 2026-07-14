"use client";

import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { BudgetBadge } from "./BudgetBadge";
import { PoLineRow, computeLineAmount } from "./PoLineRow";
import type { PoFormValues, PoLineError } from "../schemas/order.schema";
import type {
  BudgetStatus,
  CostCentreOption,
  GodownOption,
  ItemOption,
  PurposeOption,
} from "../types";

type LineDraft = PoFormValues["lines"][number];

const GRID =
  "minmax(160px,1.6fr) 80px 96px 96px 110px minmax(120px,1.2fr) minmax(120px,1.2fr) minmax(120px,1.2fr) 120px 40px";

/**
 * PO line grid (brief §Scope 5; spec §4/§5). Full data-grid at ≥lg with every column
 * visible — Item · UoM · Ordered qty · Rate · Line amount · Godown · Cost centre · Purpose
 * · Budget · Remove — dimensions never collapsed (Required by brief). At ≥md the grid
 * scrolls horizontally within its own container; below md the rows render as stacked
 * per-line cards via `PoLineRow`. Live amount preview is `orderedQty × rate`; the advisory
 * over-budget badge is `aria-live="polite"` (brief §Scope 13) and NEVER blocks Save/Approve.
 * "Add line" appends a blank; the last remaining line's remove is disabled and the empty-
 * lines error surfaces the "Add a line to continue." banner in the parent editor.
 */
export function PoLineGrid({
  lines,
  items,
  costCentres,
  purposes,
  godowns,
  purposesLoading,
  budgetByLine,
  errors,
  disabled,
  projectSelected,
  onLineChange,
  onAddLine,
  onRemoveLine,
  onAddPurpose,
}: {
  lines: LineDraft[];
  items: ItemOption[];
  costCentres: CostCentreOption[];
  purposes: PurposeOption[];
  godowns: GodownOption[];
  purposesLoading?: boolean;
  budgetByLine: Array<BudgetStatus | null>;
  errors: PoLineError[];
  disabled?: boolean;
  projectSelected: boolean;
  onLineChange: (index: number, patch: Partial<LineDraft>) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onAddPurpose?: (name: string) => void;
}) {
  const canRemove = lines.length > 1;

  return (
    <div data-testid="po-lines">
      {/* ≥lg data-grid */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 1200 }}>
          <div
            role="row"
            className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="py-2.5">Item</div>
            <div className="py-2.5">UoM</div>
            <div className="py-2.5 text-right">Ordered qty</div>
            <div className="py-2.5 text-right">Rate ৳</div>
            <div className="py-2.5 text-right">Line amount ৳</div>
            <div className="py-2.5">Godown</div>
            <div className="py-2.5">Cost centre</div>
            <div className="py-2.5">Purpose</div>
            <div className="py-2.5">Budget</div>
            <div className="py-2.5" />
          </div>
          {lines.map((l, i) => {
            const item = items.find((it) => it.id === l.itemId);
            const err = errors[i] ?? {};
            const amount = computeLineAmount(l.orderedQty, l.rate);
            const budget = budgetByLine[i];
            return (
              <div key={i} className="border-b border-muted">
                <div className="grid items-center gap-2 px-3" style={{ gridTemplateColumns: GRID }}>
                  <div className="min-w-0 py-2">
                    <Select
                      value={l.itemId}
                      disabled={disabled}
                      invalid={!!err.itemId}
                      aria-label={`Item for line ${i + 1}`}
                      data-testid="po-line-item"
                      onChange={(e) => onLineChange(i, { itemId: e.target.value })}
                    >
                      <option value="">Select…</option>
                      {items.filter((it) => it.isActive || it.id === l.itemId).map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="py-2 text-[12.5px] text-muted-foreground">{item?.uom ?? "—"}</div>
                  <div className="py-2">
                    <Input
                      inputMode="decimal"
                      value={l.orderedQty}
                      disabled={disabled}
                      invalid={!!err.orderedQty}
                      className="text-right font-mono tabular-nums"
                      aria-label={`Ordered quantity for line ${i + 1}`}
                      data-testid="po-line-qty"
                      onChange={(e) => onLineChange(i, { orderedQty: e.target.value })}
                    />
                  </div>
                  <div className="py-2">
                    <Input
                      inputMode="decimal"
                      value={l.rate}
                      disabled={disabled}
                      invalid={!!err.rate}
                      className="text-right font-mono tabular-nums"
                      aria-label={`Rate for line ${i + 1}`}
                      data-testid="po-line-rate"
                      onChange={(e) => onLineChange(i, { rate: e.target.value })}
                    />
                  </div>
                  <div className="py-2 text-right font-mono text-[12.5px] font-medium tabular-nums text-foreground">
                    {amount != null ? formatMoney(amount, { withSymbol: false }) : "—"}
                  </div>
                  <div className="py-2">
                    <Select
                      value={l.godownId}
                      disabled={disabled || !projectSelected}
                      invalid={!!err.godownId}
                      aria-label={`Godown for line ${i + 1}`}
                      data-testid="po-line-godown"
                      onChange={(e) => onLineChange(i, { godownId: e.target.value })}
                    >
                      <option value="">{projectSelected ? "Select…" : "—"}</option>
                      {godowns.filter((g) => g.isActive || g.id === l.godownId).map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.code}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="py-2">
                    <Select
                      value={l.costCentreId}
                      disabled={disabled}
                      invalid={!!err.costCentreId}
                      aria-label={`Cost centre for line ${i + 1}`}
                      data-testid="po-line-cc"
                      onChange={(e) => onLineChange(i, { costCentreId: e.target.value })}
                    >
                      <option value="">Select…</option>
                      {costCentres.filter((c) => c.isActive || c.id === l.costCentreId).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="py-2">
                    <div className="flex items-center gap-1">
                      <Select
                        value={l.purposeId}
                        disabled={disabled || !projectSelected}
                        invalid={!!err.purposeId}
                        aria-label={`Purpose for line ${i + 1}`}
                        data-testid="po-line-purpose"
                        onChange={(e) => onLineChange(i, { purposeId: e.target.value })}
                      >
                        <option value="">
                          {projectSelected ? (purposesLoading ? "Loading…" : "Select…") : "—"}
                        </option>
                        {purposes.filter((p) => p.isActive || p.id === l.purposeId).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                      {!disabled && projectSelected && onAddPurpose && (
                        <button
                          type="button"
                          onClick={() => {
                            const name = window.prompt("New purpose name:")?.trim();
                            if (name) onAddPurpose(name);
                          }}
                          aria-label="Add a new purpose"
                          data-testid="po-line-purpose-add"
                          className="grid h-9 w-8 flex-none place-items-center rounded-token text-accent-ink hover:bg-muted"
                        >
                          <Plus className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="py-2" aria-live="polite">
                    {budget ? (
                      <BudgetBadge status={budget} />
                    ) : (
                      <span className="text-[12px] text-faint">—</span>
                    )}
                  </div>
                  <div className="flex justify-end py-2">
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => onRemoveLine(i)}
                        disabled={!canRemove}
                        aria-label={`Remove line ${i + 1}`}
                        data-testid="po-line-remove"
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-token text-faint hover:bg-muted hover:text-destructive disabled:opacity-40",
                        )}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
                {(err.itemId || err.orderedQty || err.rate || err.godownId || err.costCentreId || err.purposeId) && (
                  <div className="px-3 pb-2 text-[12px] text-destructive-ink" role="alert">
                    {err.itemId ?? err.orderedQty ?? err.rate ?? err.godownId ?? err.costCentreId ?? err.purposeId}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* <lg per-line stacked cards */}
      <div className="flex flex-col gap-3 lg:hidden">
        {lines.map((l, i) => (
          <PoLineRow
            key={i}
            index={i}
            line={l}
            items={items}
            costCentres={costCentres}
            purposes={purposes}
            godowns={godowns}
            purposesLoading={purposesLoading}
            budget={budgetByLine[i] ?? null}
            error={errors[i]}
            disabled={disabled}
            canRemove={canRemove}
            projectSelected={projectSelected}
            onChange={(patch) => onLineChange(i, patch)}
            onRemove={() => onRemoveLine(i)}
            onAddPurpose={onAddPurpose}
          />
        ))}
      </div>

      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="md"
          className="mt-3 w-full gap-1.5 lg:w-auto"
          onClick={onAddLine}
          data-testid="po-add-line"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add line
        </Button>
      )}
    </div>
  );
}
