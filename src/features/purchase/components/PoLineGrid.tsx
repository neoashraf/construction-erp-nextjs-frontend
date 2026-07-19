"use client";

import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { money } from "../format";
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

// Columns follow Purchase Orders.dc.html editor line grid: # · Item · Ordered qty · Rate ·
// Line amount · Dimensions (godown · cost centre · purpose, stacked, project from header) ·
// Budget · trash.
const GRID = "36px minmax(180px,1.8fr) 96px 100px 120px minmax(220px,1.6fr) 130px 40px";

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
            <div className="py-2.5">#</div>
            <div className="py-2.5">Item</div>
            <div className="py-2.5 text-right">Ordered qty</div>
            <div className="py-2.5 text-right">Rate</div>
            <div className="py-2.5 text-right">Line amount</div>
            <div className="py-2.5">Dimensions</div>
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
                <div className="grid items-start gap-2 px-3 py-2" style={{ gridTemplateColumns: GRID }}>
                  <div className="pt-2.5 text-[12.5px] font-semibold text-muted-foreground">{i + 1}</div>
                  <div className="min-w-0">
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
                    {item?.uom && (
                      <p className="mt-1 text-[11px] text-faint">Unit: {item.uom}</p>
                    )}
                  </div>
                  <div className="pt-1">
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
                  {/* rate + line amount follow */}
                  <div className="pt-1">
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
                  <div className="pt-3.5 text-right font-mono text-[12.5px] font-semibold tabular-nums text-foreground">
                    {amount != null ? money(amount) : "—"}
                  </div>

                  {/* Dimensions — project (from header) + godown · cost centre · purpose, stacked. */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="font-semibold uppercase tracking-[0.3px] text-faint">Project</span>
                      <span className="text-muted-foreground">from header</span>
                    </div>
                    <DimSelect
                      label="Gdn"
                      value={l.godownId}
                      disabled={disabled || !projectSelected}
                      invalid={!!err.godownId}
                      ariaLabel={`Godown for line ${i + 1}`}
                      testid="po-line-godown"
                      placeholder={projectSelected ? "Select…" : "—"}
                      onChange={(v) => onLineChange(i, { godownId: v })}
                      options={godowns
                        .filter((g) => g.isActive || g.id === l.godownId)
                        .map((g) => ({ value: g.id, label: g.code }))}
                    />
                    <DimSelect
                      label="CC"
                      value={l.costCentreId}
                      disabled={disabled}
                      invalid={!!err.costCentreId}
                      ariaLabel={`Cost centre for line ${i + 1}`}
                      testid="po-line-cc"
                      placeholder="Select…"
                      onChange={(v) => onLineChange(i, { costCentreId: v })}
                      options={costCentres
                        .filter((c) => c.isActive || c.id === l.costCentreId)
                        .map((c) => ({ value: c.id, label: c.code }))}
                    />
                    <div className="flex items-center gap-1">
                      <DimSelect
                        label="Pur"
                        value={l.purposeId}
                        disabled={disabled || !projectSelected}
                        invalid={!!err.purposeId}
                        ariaLabel={`Purpose for line ${i + 1}`}
                        testid="po-line-purpose"
                        placeholder={projectSelected ? (purposesLoading ? "Loading…" : "Select…") : "—"}
                        onChange={(v) => onLineChange(i, { purposeId: v })}
                        options={purposes
                          .filter((p) => p.isActive || p.id === l.purposeId)
                          .map((p) => ({ value: p.id, label: p.name }))}
                      />
                      {!disabled && projectSelected && onAddPurpose && (
                        <button
                          type="button"
                          onClick={() => {
                            const name = window.prompt("New purpose name:")?.trim();
                            if (name) onAddPurpose(name);
                          }}
                          aria-label="Add a new purpose"
                          data-testid="po-line-purpose-add"
                          className="grid h-6 w-6 flex-none place-items-center rounded-token text-accent-ink hover:bg-muted"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-1" aria-live="polite">
                    {budget ? (
                      <BudgetBadge status={budget} />
                    ) : (
                      <span className="text-[12px] text-faint">—</span>
                    )}
                  </div>
                  <div className="flex justify-end pt-1">
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

/** Compact labelled select for the PO line Dimensions cell (godown · cost centre · purpose). */
function DimSelect({
  label,
  value,
  disabled,
  invalid,
  ariaLabel,
  testid,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel: string;
  testid: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border bg-surface-2 pl-2 pr-1 text-[11px]",
        invalid ? "border-destructive" : "border-border-strong",
        disabled && "opacity-60",
      )}
    >
      <span className="font-semibold uppercase tracking-[0.3px] text-faint">{label}</span>
      <select
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        data-testid={testid}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[130px] truncate bg-transparent py-1 text-[12px] text-foreground outline-none disabled:cursor-not-allowed"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
