"use client";

import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatMoney, toDecimal } from "@/lib/money";
import { BudgetBadge } from "./BudgetBadge";
import type { BillFormValues, BillLineError } from "../schemas/bill.schema";
import type {
  AccountOption,
  BudgetStatus,
  CostCentreOption,
  GodownOption,
  ItemOption,
  PurchaseMatchStatus,
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

const MATCH_LABEL: Record<PurchaseMatchStatus, string> = {
  MATCHED: "Matched",
  OVER_RECEIVED: "Over-received",
  UNDER_RECEIVED: "Under-received",
  PENDING_RECEIPT: "Pending receipt",
};

const MATCH_TONE: Record<PurchaseMatchStatus, "success" | "warning" | "info" | "neutral"> = {
  MATCHED: "success",
  OVER_RECEIVED: "warning",
  UNDER_RECEIVED: "warning",
  PENDING_RECEIPT: "neutral",
};

const GRID =
  "80px minmax(160px,1.6fr) 90px 96px 110px 96px 96px 96px minmax(120px,1.1fr) minmax(120px,1.1fr) minmax(120px,1.1fr) 120px 40px";

/**
 * Bill line grid (brief §Scope 5; spec §4/§5). Full data-grid at ≥lg: Type · Item /
 * Expense · Qty · Rate · Line amount · VAT input · TDS · AIT · Godown · Cost centre ·
 * Purpose · Budget · Remove — tax + dimension columns never collapsed (Required by
 * brief). At ≥md the grid scrolls horizontally in its own container. Type toggle
 * switches which fields are shown/required per line; live line amount preview is
 * `billedQty × rate` (client — server authoritative). Advisory over-budget badge is
 * `aria-live="polite"` and NEVER blocks Save/Post.
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
    <div data-testid="bill-lines">
      {/* ≥lg data-grid */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 1600 }}>
          <div
            role="row"
            className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="py-2.5">Type</div>
            <div className="py-2.5">Item / Expense</div>
            <div className="py-2.5 text-right">Qty</div>
            <div className="py-2.5 text-right">Rate ৳</div>
            <div className="py-2.5 text-right">Line ৳</div>
            <div className="py-2.5 text-right">VAT ৳</div>
            <div className="py-2.5 text-right">TDS ৳</div>
            <div className="py-2.5 text-right">AIT ৳</div>
            <div className="py-2.5">Godown</div>
            <div className="py-2.5">Cost centre</div>
            <div className="py-2.5">Purpose</div>
            <div className="py-2.5">Budget</div>
            <div className="py-2.5" />
          </div>
          {lines.map((l, i) => {
            const err = errors[i] ?? {};
            const amount = computeBillLineAmount(l.billedQty, l.rate);
            const budget = budgetByLine[i];
            const match = l.matchStatus as PurchaseMatchStatus | undefined;
            return (
              <div key={i} className="border-b border-muted">
                <div className="grid items-center gap-2 px-3" style={{ gridTemplateColumns: GRID }}>
                  <div className="py-2">
                    <Select
                      value={l.isStockLine ? "stock" : "expense"}
                      disabled={disabled}
                      invalid={!!err.isStockLine}
                      aria-label={`Line type for line ${i + 1}`}
                      data-testid="bill-line-type"
                      onChange={(e) =>
                        onLineChange(i, {
                          isStockLine: e.target.value === "stock",
                          itemId: e.target.value === "stock" ? l.itemId : "",
                          expenseAccountId: e.target.value === "expense" ? l.expenseAccountId : "",
                          godownId: e.target.value === "stock" ? l.godownId : "",
                        })
                      }
                    >
                      <option value="stock">Item</option>
                      <option value="expense">Expense</option>
                    </Select>
                  </div>
                  <div className="min-w-0 py-2">
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
                  <div className="py-2">
                    <Input
                      inputMode="decimal"
                      value={l.billedQty}
                      disabled={disabled}
                      invalid={!!err.billedQty}
                      className="text-right font-mono tabular-nums"
                      aria-label={`Billed quantity for line ${i + 1}`}
                      data-testid="bill-line-qty"
                      onChange={(e) => onLineChange(i, { billedQty: e.target.value })}
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
                      data-testid="bill-line-rate"
                      onChange={(e) => onLineChange(i, { rate: e.target.value })}
                    />
                  </div>
                  <div className="py-2 text-right font-mono text-[12.5px] font-medium tabular-nums text-foreground">
                    {amount != null ? formatMoney(amount, { withSymbol: false }) : "—"}
                  </div>
                  <div className="py-2">
                    <Input
                      inputMode="decimal"
                      value={l.vatInputAmount}
                      disabled={disabled}
                      invalid={!!err.vatInputAmount}
                      className="text-right font-mono tabular-nums"
                      aria-label={`VAT input for line ${i + 1}`}
                      data-testid="bill-line-vat"
                      onChange={(e) => onLineChange(i, { vatInputAmount: e.target.value })}
                    />
                  </div>
                  <div className="py-2">
                    <Input
                      inputMode="decimal"
                      value={l.tdsAmount}
                      disabled={disabled}
                      invalid={!!err.tdsAmount}
                      className="text-right font-mono tabular-nums"
                      aria-label={`TDS for line ${i + 1}`}
                      data-testid="bill-line-tds"
                      onChange={(e) => onLineChange(i, { tdsAmount: e.target.value })}
                    />
                  </div>
                  <div className="py-2">
                    <Input
                      inputMode="decimal"
                      value={l.aitAmount}
                      disabled={disabled}
                      invalid={!!err.aitAmount}
                      className="text-right font-mono tabular-nums"
                      aria-label={`AIT for line ${i + 1}`}
                      data-testid="bill-line-ait"
                      onChange={(e) => onLineChange(i, { aitAmount: e.target.value })}
                    />
                  </div>
                  <div className="py-2">
                    {l.isStockLine ? (
                      <Select
                        value={l.godownId ?? ""}
                        disabled={disabled || !projectSelected}
                        invalid={!!err.godownId}
                        aria-label={`Godown for line ${i + 1}`}
                        data-testid="bill-line-godown"
                        onChange={(e) => onLineChange(i, { godownId: e.target.value })}
                      >
                        <option value="">{projectSelected ? "Select…" : "—"}</option>
                        {godowns.filter((g) => g.isActive || g.id === l.godownId).map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.code}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="text-[12px] text-faint">—</span>
                    )}
                  </div>
                  <div className="py-2">
                    <Select
                      value={l.costCentreId}
                      disabled={disabled}
                      invalid={!!err.costCentreId}
                      aria-label={`Cost centre for line ${i + 1}`}
                      data-testid="bill-line-cc"
                      onChange={(e) => onLineChange(i, { costCentreId: e.target.value })}
                    >
                      <option value="">Select…</option>
                      {costCentres
                        .filter((c) => c.isActive || c.id === l.costCentreId)
                        .map((c) => (
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
                        data-testid="bill-line-purpose"
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
                          data-testid="bill-line-purpose-add"
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
                {match && (
                  <div className="px-3 pb-2">
                    <Badge tone={MATCH_TONE[match]} dot data-testid={`bill-line-match-${match}`}>
                      {MATCH_LABEL[match]}
                      {l.receivedQty ? ` · ${l.receivedQty}` : ""}
                    </Badge>
                  </div>
                )}
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

      {/* <lg per-line stacked cards (back-office only) */}
      <div className="flex flex-col gap-3 lg:hidden">
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
                <Select
                  value={l.isStockLine ? "stock" : "expense"}
                  disabled={disabled}
                  aria-label={`Line type for line ${i + 1}`}
                  onChange={(e) =>
                    onLineChange(i, {
                      isStockLine: e.target.value === "stock",
                      itemId: e.target.value === "stock" ? l.itemId : "",
                      expenseAccountId: e.target.value === "expense" ? l.expenseAccountId : "",
                      godownId: e.target.value === "stock" ? l.godownId : "",
                    })
                  }
                  className="w-28"
                >
                  <option value="stock">Item</option>
                  <option value="expense">Expense</option>
                </Select>
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
                  <Input
                    inputMode="decimal"
                    value={l.billedQty}
                    onChange={(e) => onLineChange(i, { billedQty: e.target.value })}
                    invalid={!!err.billedQty}
                    className="text-right font-mono tabular-nums"
                  />
                </MobileField>
                <MobileField label="Rate">
                  <Input
                    inputMode="decimal"
                    value={l.rate}
                    onChange={(e) => onLineChange(i, { rate: e.target.value })}
                    invalid={!!err.rate}
                    className="text-right font-mono tabular-nums"
                  />
                </MobileField>
                <MobileField label="Line">
                  <div className="pr-2 text-right font-mono text-[13px] tabular-nums text-foreground">
                    {amount != null ? formatMoney(amount, { withSymbol: false }) : "—"}
                  </div>
                </MobileField>
              </div>
            </div>
          );
        })}
      </div>

      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="md"
          className="mt-3 w-full gap-1.5 lg:w-auto"
          onClick={onAddLine}
          data-testid="bill-add-line"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add line
        </Button>
      )}
    </div>
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
