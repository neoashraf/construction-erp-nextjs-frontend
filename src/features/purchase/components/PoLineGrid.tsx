"use client";

import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { NumericInput } from "@/components/ui/numeric-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { moneyWithSymbol } from "../format";
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

// Columns follow Purchase Orders.dc.html editor line grid exactly:
// # · Item · Ordered qty · Rate ৳ · Line amount ৳ · Dimensions (godown · cost centre · purpose,
// stacked, project from header) · Budget · trash.
const GRID = "30px 1.6fr 96px 110px 130px 1.5fr 150px 40px";

/**
 * PO line grid (brief §Scope 5; spec §4/§5; Purchase Orders.dc.html editor "LINE GRID").
 * A bordered card: a 44px header row over per-line rows on an 8-column grid, then an
 * "Add line" + "PO order total" footer strip. Dimensions stack under a "PROJECT … from header"
 * caption as three full-width labelled selects (Gdn · CC · Pur). The advisory over-budget badge
 * is `aria-live="polite"` (brief §Scope 13) and NEVER blocks Save/Approve. At <lg the rows
 * render as stacked per-line cards via `PoLineRow`; the footer total shows at every width.
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
  projectLabel,
  orderTotal,
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
  projectLabel: string;
  orderTotal: string;
  onLineChange: (index: number, patch: Partial<LineDraft>) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onAddPurpose?: (name: string) => void;
}) {
  const canRemove = lines.length > 1;
  const projectCaption = projectLabel || "—";

  return (
    <div
      className="overflow-hidden rounded-card border border-border bg-surface shadow-sm"
      data-testid="po-lines"
    >
      {/* ≥lg data-grid */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 1080 }}>
          {/* header row */}
          <div
            role="row"
            className="grid items-center border-b border-border-strong bg-surface-2"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="flex h-11 items-center px-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">#</div>
            <div className="flex h-11 items-center px-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Item</div>
            <div className="flex h-11 items-center justify-end px-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Ordered qty</div>
            <div className="flex h-11 items-center justify-end px-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Rate ৳</div>
            <div className="flex h-11 items-center justify-end px-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Line amount ৳</div>
            <div className="flex h-11 items-center gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              Dimensions
              <span className="font-medium normal-case tracking-normal text-faint">— godown · cost centre · purpose</span>
            </div>
            <div className="flex h-11 items-center px-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Budget</div>
            <div className="h-11" />
          </div>

          {/* line rows */}
          {lines.map((l, i) => {
            const err = errors[i] ?? {};
            const amount = computeLineAmount(l.orderedQty, l.rate);
            const budget = budgetByLine[i];
            return (
              <div key={i} className="border-b border-border">
                <div className="grid items-start" style={{ gridTemplateColumns: GRID }}>
                  <div className="px-2.5 py-3.5 text-[12.5px] font-semibold tabular-nums text-faint">{i + 1}</div>
                  {/* item */}
                  <div className="min-w-0 p-3">
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
                  {/* ordered qty */}
                  <div className="p-3">
                    <NumericInput
                      mode="decimal"
                      decimalPlaces={3}
                      value={l.orderedQty}
                      disabled={disabled}
                      invalid={!!err.orderedQty}
                      className="text-right font-mono tabular-nums"
                      aria-label={`Ordered quantity for line ${i + 1}`}
                      data-testid="po-line-qty"
                      onChange={(e) => onLineChange(i, { orderedQty: e.target.value })}
                    />
                  </div>
                  {/* rate */}
                  <div className="p-3">
                    <NumericInput
                      mode="decimal"
                      decimalPlaces={4}
                      value={l.rate}
                      disabled={disabled}
                      invalid={!!err.rate}
                      className="text-right font-mono tabular-nums"
                      aria-label={`Rate for line ${i + 1}`}
                      data-testid="po-line-rate"
                      onChange={(e) => onLineChange(i, { rate: e.target.value })}
                    />
                  </div>
                  {/* line amount */}
                  <div className="px-3 py-3.5 text-right font-mono text-[13px] font-semibold tabular-nums text-foreground whitespace-nowrap">
                    {amount != null ? moneyWithSymbol(amount) : "—"}
                  </div>

                  {/* dimensions — project (from header) + godown · cost centre · purpose, stacked */}
                  <div className="min-w-0 p-3">
                    <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
                      <span className="text-[9.5px] font-bold uppercase tracking-[0.4px] text-faint">Project</span>
                      <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">{projectCaption}</span>
                      <span className="flex-none text-[9.5px] text-faint">· from header</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <DimSelect
                        tag="Gdn"
                        value={l.godownId}
                        disabled={disabled || !projectSelected}
                        invalid={!!err.godownId}
                        ariaLabel={`Godown for line ${i + 1}`}
                        testid="po-line-godown"
                        placeholder={projectSelected ? "Select…" : "—"}
                        onChange={(v) => onLineChange(i, { godownId: v })}
                        options={godowns
                          .filter((g) => g.isActive || g.id === l.godownId)
                          .map((g) => ({ value: g.id, label: `${g.code} — ${g.name}` }))}
                      />
                      <DimSelect
                        tag="CC"
                        value={l.costCentreId}
                        disabled={disabled}
                        invalid={!!err.costCentreId}
                        ariaLabel={`Cost centre for line ${i + 1}`}
                        testid="po-line-cc"
                        placeholder="Select…"
                        onChange={(v) => onLineChange(i, { costCentreId: v })}
                        options={costCentres
                          .filter((c) => c.isActive || c.id === l.costCentreId)
                          .map((c) => ({ value: c.id, label: c.name }))}
                      />
                      <div className="flex items-center gap-1">
                        <DimSelect
                          tag="Pur"
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
                  </div>

                  {/* budget */}
                  <div className="px-3 py-3" aria-live="polite">
                    {budget ? (
                      <BudgetBadge status={budget} />
                    ) : (
                      <span className="text-[12px] text-faint">—</span>
                    )}
                  </div>
                  {/* remove */}
                  <div className="flex justify-center px-2 py-3">
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => onRemoveLine(i)}
                        disabled={!canRemove}
                        aria-label={`Remove line ${i + 1}`}
                        data-testid="po-line-remove"
                        className={cn(
                          "grid h-7 w-7 place-items-center rounded-token text-faint hover:bg-muted hover:text-destructive disabled:opacity-40",
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
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

          {/* add line + total footer */}
          <div className="flex items-center gap-3.5 bg-surface-2 px-3.5 py-3">
            {!disabled && (
              <button
                type="button"
                onClick={onAddLine}
                data-testid="po-add-line"
                className="flex h-8 items-center gap-1.5 rounded-token border border-dashed border-border-strong bg-surface px-3 text-[12.5px] font-semibold text-foreground hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add line
              </button>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">PO order total</span>
              <span className="text-[18px] font-bold tabular-nums text-foreground" data-testid="po-total">
                {moneyWithSymbol(orderTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* <lg per-line stacked cards */}
      <div className="flex flex-col gap-3 p-3 lg:hidden">
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
            projectLabel={projectLabel}
            onChange={(patch) => onLineChange(i, patch)}
            onRemove={() => onRemoveLine(i)}
            onAddPurpose={onAddPurpose}
          />
        ))}
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="md"
            className="w-full gap-1.5"
            onClick={onAddLine}
            data-testid="po-add-line-mobile"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add line
          </Button>
        )}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">PO order total</span>
          <span className="text-[17px] font-bold tabular-nums text-foreground">{moneyWithSymbol(orderTotal)}</span>
        </div>
      </div>
    </div>
  );
}

/** Full-width labelled select for the PO line Dimensions cell (godown · cost centre · purpose). */
function DimSelect({
  tag,
  value,
  disabled,
  invalid,
  ariaLabel,
  testid,
  placeholder,
  options,
  onChange,
}: {
  tag: string;
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
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-[9.5px] font-bold uppercase tracking-[0.4px] text-faint">
        {tag}
      </span>
      <select
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        data-testid={testid}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-8 w-full appearance-none truncate rounded-md border bg-surface pl-11 pr-7 text-[12.5px] text-foreground outline-none",
          "focus:border-accent focus:shadow-focus",
          "disabled:cursor-not-allowed disabled:opacity-60",
          invalid ? "border-destructive" : "border-border-strong",
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-faint">▾</span>
    </div>
  );
}
