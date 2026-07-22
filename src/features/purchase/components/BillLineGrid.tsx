"use client";

import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { NumericInput } from "@/components/ui/numeric-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toDecimal } from "@/lib/money";
import { money } from "../format";
import type { BillFormValues, BillLineError } from "../schemas/bill.schema";
import type {
  AccountOption,
  BudgetStatus,
  CostCentreOption,
  GodownOption,
  ItemOption,
  PurposeOption,
} from "../types";

type LineDraft = BillFormValues["lines"][number];

/** Client preview of a line amount (`billedQty × rate`, exact decimal). */
export function computeBillLineAmount(qty: string, rate: string): string | null {
  const q = Number(qty);
  const r = Number(rate);
  if (!Number.isFinite(q) || !Number.isFinite(r) || q <= 0 || r < 0) return null;
  return toDecimal(String(q)).times(toDecimal(String(r))).toFixed(4);
}

// Columns follow Purchase Bill.dc.html editor line grid: # · Item/Expense · Qty · Rate ·
// Line amt · VAT in · TDS · AIT · trash. The four dimensions (godown · cost centre ·
// purpose) + budget/receipt status live as a CHIP SUB-ROW inside the Item/Expense cell,
// not as separate columns.
const GRID = "36px minmax(240px,2fr) 90px 100px 110px 96px 92px 92px 40px";

/**
 * Bill line grid (brief §Scope 5; spec §4/§5). Full data-grid at ≥lg with a leading line-
 * number column, then the Item/Expense cell (Item|Expense segmented toggle + item/account
 * picker + a dimension chip sub-row + advisory budget & receipt chips), then the money
 * columns (Qty · Rate · Line · VAT · TDS · AIT) and a remove control. At <lg lines stack as
 * cards. Line amount preview is `billedQty × rate` (client; server authoritative). The
 * advisory over-budget badge is `aria-live="polite"` and NEVER blocks Save/Post.
 */
export function BillLineGrid({
  lines,
  items,
  expenseAccounts,
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
  expenseAccounts: AccountOption[];
  costCentres: CostCentreOption[];
  purposes: PurposeOption[];
  godowns: GodownOption[];
  purposesLoading?: boolean;
  budgetByLine: Array<BudgetStatus | null>;
  errors: BillLineError[];
  disabled?: boolean;
  projectSelected: boolean;
  onLineChange: (index: number, patch: Partial<LineDraft>) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onAddPurpose?: (name: string) => void;
}) {
  const canRemove = lines.length > 1;

  return (
    <div
      className="overflow-hidden rounded-card border border-border bg-surface shadow-sm"
      data-testid="bill-lines"
    >
      {/* ≥lg data-grid */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 980 }}>
          <div
            role="row"
            className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="py-2.5">#</div>
            <div className="py-2.5">Item / Expense</div>
            <div className="py-2.5 text-right">Qty</div>
            <div className="py-2.5 text-right">Rate ৳</div>
            <div className="py-2.5 text-right">Line amt ৳</div>
            <div className="py-2.5 text-right">VAT in ৳</div>
            <div className="py-2.5 text-right">TDS ৳</div>
            <div className="py-2.5 text-right">AIT ৳</div>
            <div className="py-2.5" />
          </div>
          {lines.map((l, i) => {
            const err = errors[i] ?? {};
            const amount = computeBillLineAmount(l.billedQty, l.rate);
            const budget = budgetByLine[i];
            return (
              <div key={i} className="border-b border-muted">
                <div className="grid items-start gap-2 px-3 py-2" style={{ gridTemplateColumns: GRID }}>
                  <div className="pt-2.5 text-[12.5px] font-semibold text-muted-foreground">{i + 1}</div>

                  {/* Item / Expense cell: toggle + picker + dimension chip sub-row + status chips */}
                  <div className="min-w-0">
                    <TypeToggle
                      value={l.isStockLine ? "stock" : "expense"}
                      disabled={disabled}
                      onChange={(v) =>
                        onLineChange(i, {
                          isStockLine: v === "stock",
                          itemId: v === "stock" ? l.itemId : "",
                          expenseAccountId: v === "expense" ? l.expenseAccountId : "",
                          godownId: v === "stock" ? l.godownId : "",
                        })
                      }
                      lineNo={i + 1}
                    />
                    <div className="mt-1.5">
                      {l.isStockLine ? (
                        <Select
                          value={l.itemId ?? ""}
                          disabled={disabled}
                          invalid={!!err.itemId}
                          aria-label={`Item for line ${i + 1}`}
                          data-testid="bill-line-item"
                          onChange={(e) => onLineChange(i, { itemId: e.target.value })}
                        >
                          <option value="">Select an item…</option>
                          {items.filter((it) => it.isActive || it.id === l.itemId).map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Select
                          value={l.expenseAccountId ?? ""}
                          disabled={disabled}
                          invalid={!!err.expenseAccountId}
                          aria-label={`Expense account for line ${i + 1}`}
                          data-testid="bill-line-expense"
                          onChange={(e) => onLineChange(i, { expenseAccountId: e.target.value })}
                        >
                          <option value="">Select an expense account…</option>
                          {expenseAccounts
                            .filter((a) => a.isActive || a.id === l.expenseAccountId)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code} — {a.name}
                              </option>
                            ))}
                        </Select>
                      )}
                    </div>

                    {/* Dimension chip sub-row — bordered box chips (Purchase Bill.dc.html) */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <ChipSelect
                        label="Godown"
                        value={l.godownId ?? ""}
                        disabled={disabled || !l.isStockLine || !projectSelected}
                        invalid={!!err.godownId}
                        ariaLabel={`Godown for line ${i + 1}`}
                        testid="bill-line-godown"
                        placeholder={l.isStockLine ? (projectSelected ? "Select…" : "—") : "No godown · service line"}
                        onChange={(v) => onLineChange(i, { godownId: v })}
                        options={godowns
                          .filter((g) => g.isActive || g.id === l.godownId)
                          .map((g) => ({ value: g.id, label: `${g.code} — ${g.name}` }))}
                      />
                      <ChipSelect
                        label="Cost centre"
                        value={l.costCentreId}
                        disabled={disabled}
                        invalid={!!err.costCentreId}
                        ariaLabel={`Cost centre for line ${i + 1}`}
                        testid="bill-line-cc"
                        placeholder="Select…"
                        onChange={(v) => onLineChange(i, { costCentreId: v })}
                        options={costCentres
                          .filter((c) => c.isActive || c.id === l.costCentreId)
                          .map((c) => ({ value: c.id, label: c.name }))}
                      />
                      <div className="flex items-center gap-1">
                        <ChipSelect
                          label="Purpose"
                          value={l.purposeId}
                          disabled={disabled || !projectSelected}
                          invalid={!!err.purposeId}
                          ariaLabel={`Purpose for line ${i + 1}`}
                          testid="bill-line-purpose"
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
                            data-testid="bill-line-purpose-add"
                            className="grid h-6 w-6 flex-none place-items-center rounded-token text-accent-ink hover:bg-muted"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                      </div>
                      <span aria-live="polite">
                        {budget && <BudgetBoxChip status={budget} />}
                      </span>
                      <ReceiptChip isStockLine={l.isStockLine} matchStatus={l.matchStatus} />
                    </div>
                  </div>

                  <div className="mt-8 pt-1">
                    <NumericInput
                      mode="decimal"
                      decimalPlaces={3}
                      value={l.billedQty}
                      disabled={disabled || !l.isStockLine}
                      invalid={!!err.billedQty}
                      className="text-right font-mono tabular-nums"
                      aria-label={`Billed quantity for line ${i + 1}`}
                      data-testid="bill-line-qty"
                      onChange={(e) => onLineChange(i, { billedQty: e.target.value })}
                    />
                  </div>
                  <div className="mt-8 pt-1">
                    <NumericInput
                      mode="decimal"
                      decimalPlaces={4}
                      value={l.rate}
                      disabled={disabled}
                      invalid={!!err.rate}
                      className="text-right font-mono tabular-nums"
                      aria-label={`Rate for line ${i + 1}`}
                      data-testid="bill-line-rate"
                      onChange={(e) => onLineChange(i, { rate: e.target.value })}
                    />
                  </div>
                  <div className="mt-8 flex h-9 items-center justify-end pt-1 text-right font-mono text-[12.5px] font-semibold tabular-nums text-foreground">
                    {amount != null ? money(amount) : "—"}
                  </div>
                  <div className="mt-8 pt-1">
                    <NumericInput
                      mode="decimal"
                      decimalPlaces={4}
                      value={l.vatInputAmount}
                      disabled={disabled}
                      invalid={!!err.vatInputAmount}
                      className="text-right font-mono tabular-nums"
                      aria-label={`VAT input for line ${i + 1}`}
                      data-testid="bill-line-vat"
                      onChange={(e) => onLineChange(i, { vatInputAmount: e.target.value })}
                    />
                  </div>
                  <div className="mt-8 pt-1">
                    <NumericInput
                      mode="decimal"
                      decimalPlaces={4}
                      value={l.tdsAmount}
                      disabled={disabled}
                      invalid={!!err.tdsAmount}
                      className="text-right font-mono tabular-nums"
                      aria-label={`TDS for line ${i + 1}`}
                      data-testid="bill-line-tds"
                      onChange={(e) => onLineChange(i, { tdsAmount: e.target.value })}
                    />
                  </div>
                  <div className="mt-8 pt-1">
                    <NumericInput
                      mode="decimal"
                      decimalPlaces={4}
                      value={l.aitAmount}
                      disabled={disabled}
                      invalid={!!err.aitAmount}
                      className="text-right font-mono tabular-nums"
                      aria-label={`AIT for line ${i + 1}`}
                      data-testid="bill-line-ait"
                      onChange={(e) => onLineChange(i, { aitAmount: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end pt-2">
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => onRemoveLine(i)}
                        disabled={!canRemove}
                        aria-label={`Remove line ${i + 1}`}
                        data-testid="bill-line-remove"
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-token text-faint hover:bg-muted hover:text-destructive disabled:opacity-40",
                        )}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
                {(err.isStockLine ||
                  err.itemId ||
                  err.expenseAccountId ||
                  err.billedQty ||
                  err.rate ||
                  err.vatInputAmount ||
                  err.tdsAmount ||
                  err.aitAmount ||
                  err.godownId ||
                  err.costCentreId ||
                  err.purposeId) && (
                  <div className="px-3 pb-2 text-[12px] text-destructive-ink" role="alert">
                    {err.isStockLine ??
                      err.itemId ??
                      err.expenseAccountId ??
                      err.billedQty ??
                      err.rate ??
                      err.vatInputAmount ??
                      err.tdsAmount ??
                      err.aitAmount ??
                      err.godownId ??
                      err.costCentreId ??
                      err.purposeId}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* add line + hint footer (≥lg, inside the grid card) */}
      {!disabled && (
        <div className="hidden items-center gap-3.5 bg-surface-2 px-3.5 py-3 lg:flex">
          <button
            type="button"
            onClick={onAddLine}
            data-testid="bill-add-line"
            className="flex h-8 items-center gap-1.5 rounded-token border border-dashed border-border-strong bg-surface px-3 text-[12.5px] font-semibold text-foreground hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add line
          </button>
          <span className="text-[12px] text-faint">
            Stock line = item + godown · service line = expense account only.
          </span>
        </div>
      )}

      {/* <lg per-line stacked cards (back-office only) */}
      <div className="flex flex-col gap-3 p-3 lg:hidden">
        {lines.map((l, i) => {
          const err = errors[i] ?? {};
          const amount = computeBillLineAmount(l.billedQty, l.rate);
          return (
            <div
              key={i}
              className="rounded-card border border-border bg-surface p-3 shadow-sm"
              data-testid={`bill-line-card-${i}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <TypeToggle
                  value={l.isStockLine ? "stock" : "expense"}
                  disabled={disabled}
                  onChange={(v) =>
                    onLineChange(i, {
                      isStockLine: v === "stock",
                      itemId: v === "stock" ? l.itemId : "",
                      expenseAccountId: v === "expense" ? l.expenseAccountId : "",
                      godownId: v === "stock" ? l.godownId : "",
                    })
                  }
                  lineNo={i + 1}
                />
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onRemoveLine(i)}
                    disabled={!canRemove}
                    aria-label={`Remove line ${i + 1}`}
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-token text-faint hover:bg-muted hover:text-destructive disabled:opacity-40",
                    )}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
              {l.isStockLine ? (
                <Select
                  value={l.itemId ?? ""}
                  disabled={disabled}
                  invalid={!!err.itemId}
                  aria-label={`Item for line ${i + 1}`}
                  onChange={(e) => onLineChange(i, { itemId: e.target.value })}
                >
                  <option value="">Select an item…</option>
                  {items.filter((it) => it.isActive || it.id === l.itemId).map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <Select
                  value={l.expenseAccountId ?? ""}
                  disabled={disabled}
                  invalid={!!err.expenseAccountId}
                  aria-label={`Expense account for line ${i + 1}`}
                  onChange={(e) => onLineChange(i, { expenseAccountId: e.target.value })}
                >
                  <option value="">Select an expense account…</option>
                  {expenseAccounts
                    .filter((a) => a.isActive || a.id === l.expenseAccountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                </Select>
              )}
              <div className="mt-2 grid grid-cols-3 gap-2">
                <MobileField label="Qty">
                  <NumericInput
                    mode="decimal"
                    decimalPlaces={3}
                    value={l.billedQty}
                    onChange={(e) => onLineChange(i, { billedQty: e.target.value })}
                    invalid={!!err.billedQty}
                    disabled={disabled || !l.isStockLine}
                    className="text-right font-mono tabular-nums"
                  />
                </MobileField>
                <MobileField label="Rate">
                  <NumericInput
                    mode="decimal"
                    decimalPlaces={4}
                    value={l.rate}
                    onChange={(e) => onLineChange(i, { rate: e.target.value })}
                    invalid={!!err.rate}
                    className="text-right font-mono tabular-nums"
                  />
                </MobileField>
                <MobileField label="Line">
                  <div className="pr-2 text-right font-mono text-[13px] tabular-nums text-foreground">
                    {amount != null ? money(amount) : "—"}
                  </div>
                </MobileField>
              </div>
            </div>
          );
        })}
      </div>

      {!disabled && (
        <div className="flex flex-col items-start gap-2 px-3 pb-3 lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="md"
            className="w-full gap-1.5"
            onClick={onAddLine}
            data-testid="bill-add-line-mobile"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add line
          </Button>
          <span className="text-[12px] text-faint">
            Stock line = item + godown · service line = expense account only.
          </span>
        </div>
      )}
    </div>
  );
}

/** Item | Expense segmented toggle (Purchase Bill.dc.html line cell). */
function TypeToggle({
  value,
  disabled,
  onChange,
  lineNo,
}: {
  value: "stock" | "expense";
  disabled?: boolean;
  onChange: (v: "stock" | "expense") => void;
  lineNo: number;
}) {
  return (
    <div
      className="inline-flex rounded-token border border-border-strong p-0.5"
      role="group"
      aria-label={`Line type for line ${lineNo}`}
      data-testid="bill-line-type"
    >
      {(["stock", "expense"] as const).map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            data-testid={`bill-line-type-${opt}`}
            onClick={() => !active && onChange(opt)}
            className={cn(
              "rounded-[6px] px-2.5 py-1 text-[12px] font-semibold transition-colors disabled:opacity-60",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {opt === "stock" ? "Item" : "Expense"}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Bordered-box labelled select used in the line dimension sub-row (Purchase Bill.dc.html):
 * a 32px-high box with the small-caps tag + value + chevron, matching the header field boxes.
 */
function ChipSelect({
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
  const tag = label === "Cost centre" ? "CC" : label === "Godown" ? "Gdn" : label === "Purpose" ? "Pur" : label;
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
          "h-8 max-w-[190px] appearance-none truncate rounded-md border bg-surface pl-11 pr-7 text-[12.5px] text-foreground outline-none",
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

/**
 * Advisory budget box-chip (32px bordered box with dot + label), matching the design's line
 * dimension strip. Text + dot, never colour-only. Never blocks Save/Post (FR-PUR-019).
 */
function BudgetBoxChip({ status }: { status: BudgetStatus }) {
  const TONE: Record<BudgetStatus, string> = {
    OK: "bg-success-soft text-success-ink",
    APPROACHING: "bg-warning-soft text-warning-ink",
    OVER: "bg-destructive-soft text-destructive-ink",
    UNBUDGETED: "bg-muted text-muted-foreground",
  };
  const DOT: Record<BudgetStatus, string> = {
    OK: "bg-success",
    APPROACHING: "bg-warning",
    OVER: "bg-destructive",
    UNBUDGETED: "bg-muted-foreground",
  };
  const LABEL: Record<BudgetStatus, string> = {
    OK: "Within budget",
    APPROACHING: "Approaching budget",
    OVER: "Over budget",
    UNBUDGETED: "No budget set",
  };
  return (
    <span
      title="This is advisory only — it won't stop you from posting."
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold", TONE[status])}
      data-testid={`bill-budget-${status}`}
    >
      <span className={cn("h-1.5 w-1.5 flex-none rounded-full", DOT[status])} aria-hidden />
      {LABEL[status]}
    </span>
  );
}

/**
 * Receipt status chip (Purchase Bill.dc.html): a stock line awaiting receipt shows
 * "Pending receipt" (info); a service (non-stock) line carries no GRN → "No GRN — service"
 * (neutral). A stock line already matched/received shows nothing here (the ledger/GRN track
 * the real match on the posted viewer).
 */
function ReceiptChip({
  isStockLine,
  matchStatus,
}: {
  isStockLine: boolean;
  matchStatus?: string;
}) {
  if (!isStockLine) {
    return <BoxChip tone="neutral" label="No GRN — service" testid="bill-line-receipt-service" />;
  }
  if (!matchStatus || matchStatus === "PENDING_RECEIPT") {
    return <BoxChip tone="info" label="Pending receipt" testid="bill-line-receipt-pending" />;
  }
  return null;
}

/** A 32px bordered/soft box chip with a status dot — the design's line status chip shape. */
function BoxChip({
  tone,
  label,
  testid,
}: {
  tone: "info" | "neutral";
  label: string;
  testid: string;
}) {
  const cls = tone === "info" ? "bg-info-soft text-info-ink" : "bg-muted text-muted-foreground";
  const dot = tone === "info" ? "bg-info" : "bg-muted-foreground";
  return (
    <span
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold", cls)}
      data-testid={testid}
    >
      <span className={cn("h-1.5 w-1.5 flex-none rounded-full", dot)} aria-hidden />
      {label}
    </span>
  );
}

function MobileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">{label}</div>
      {children}
    </div>
  );
}
