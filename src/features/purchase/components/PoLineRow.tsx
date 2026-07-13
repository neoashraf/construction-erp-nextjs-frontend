"use client";

import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney, toDecimal } from "@/lib/money";
import { BudgetBadge } from "./BudgetBadge";
import type { PoFormValues, PoLineError } from "../schemas/order.schema";
import type {
  BudgetStatus,
  CostCentreOption,
  GodownOption,
  ItemOption,
  PurposeOption,
} from "../types";

type LineDraft = PoFormValues["lines"][number];

/** Derived line amount preview (`orderedQty × rate`) — null when either is empty/invalid. */
export function computeLineAmount(orderedQty: string, rate: string): string | null {
  if (!orderedQty || !rate) return null;
  const q = Number(orderedQty);
  const r = Number(rate);
  if (!(q > 0) || !(r >= 0)) return null;
  return toDecimal(orderedQty).times(toDecimal(rate)).toFixed(4);
}

/**
 * One PO line as a stacked card for the ≥360 mobile view (spec §4). At ≥lg the row renders
 * inline inside `PoLineGrid`; on narrow screens the card here lays each field as a stacked
 * label→control with the same design-system field states. Dimension selects are project-
 * scoped (`disabled` until a project is chosen). The advisory over-budget badge sits in the
 * card footer with the derived line amount; it never blocks Save/Approve (FR-PUR-019).
 */
export function PoLineRow({
  index,
  line,
  items,
  costCentres,
  purposes,
  godowns,
  purposesLoading,
  budget,
  error,
  disabled,
  canRemove,
  projectSelected,
  onChange,
  onRemove,
  onAddPurpose,
}: {
  index: number;
  line: LineDraft;
  items: ItemOption[];
  costCentres: CostCentreOption[];
  purposes: PurposeOption[];
  godowns: GodownOption[];
  purposesLoading?: boolean;
  budget: BudgetStatus | null;
  error?: PoLineError;
  disabled?: boolean;
  canRemove: boolean;
  projectSelected: boolean;
  onChange: (patch: Partial<LineDraft>) => void;
  onRemove: () => void;
  onAddPurpose?: (name: string) => void;
}) {
  const amount = computeLineAmount(line.orderedQty, line.rate);
  const item = items.find((i) => i.id === line.itemId);
  const uom = item?.uom ?? "";

  return (
    <div className="rounded-card border border-border bg-surface p-3" data-testid="po-line-card">
      <FieldBlock label="Item" htmlFor={`po-line-item-${index}`} error={error?.itemId}>
        <Select
          id={`po-line-item-${index}`}
          value={line.itemId}
          disabled={disabled}
          invalid={!!error?.itemId}
          aria-label={`Item for line ${index + 1}`}
          data-testid="po-line-item"
          onChange={(e) => onChange({ itemId: e.target.value })}
        >
          <option value="">Select an item…</option>
          {items.filter((i) => i.isActive || i.id === line.itemId).map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
      </FieldBlock>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <FieldBlock label="Ordered qty" htmlFor={`po-line-qty-${index}`} error={error?.orderedQty}>
          <Input
            id={`po-line-qty-${index}`}
            inputMode="decimal"
            value={line.orderedQty}
            disabled={disabled}
            invalid={!!error?.orderedQty}
            className="text-right font-mono tabular-nums"
            aria-label={`Ordered quantity for line ${index + 1}`}
            data-testid="po-line-qty"
            onChange={(e) => onChange({ orderedQty: e.target.value })}
          />
        </FieldBlock>
        <FieldBlock label={`Rate ৳${uom ? ` / ${uom}` : ""}`} htmlFor={`po-line-rate-${index}`} error={error?.rate}>
          <Input
            id={`po-line-rate-${index}`}
            inputMode="decimal"
            value={line.rate}
            disabled={disabled}
            invalid={!!error?.rate}
            className="text-right font-mono tabular-nums"
            aria-label={`Rate for line ${index + 1}`}
            data-testid="po-line-rate"
            onChange={(e) => onChange({ rate: e.target.value })}
          />
        </FieldBlock>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <FieldBlock label="Godown" htmlFor={`po-line-godown-${index}`} error={error?.godownId}>
          <Select
            id={`po-line-godown-${index}`}
            value={line.godownId}
            disabled={disabled || !projectSelected}
            invalid={!!error?.godownId}
            aria-label={`Godown for line ${index + 1}`}
            data-testid="po-line-godown"
            onChange={(e) => onChange({ godownId: e.target.value })}
          >
            <option value="">
              {projectSelected ? "Select a godown…" : "Select a project first"}
            </option>
            {godowns.filter((g) => g.isActive || g.id === line.godownId).map((g) => (
              <option key={g.id} value={g.id}>
                {g.code} — {g.name}
              </option>
            ))}
          </Select>
        </FieldBlock>
        <FieldBlock label="Cost centre" htmlFor={`po-line-cc-${index}`} error={error?.costCentreId}>
          <Select
            id={`po-line-cc-${index}`}
            value={line.costCentreId}
            disabled={disabled}
            invalid={!!error?.costCentreId}
            aria-label={`Cost centre for line ${index + 1}`}
            data-testid="po-line-cc"
            onChange={(e) => onChange({ costCentreId: e.target.value })}
          >
            <option value="">Select a cost centre…</option>
            {costCentres.filter((c) => c.isActive || c.id === line.costCentreId).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </Select>
        </FieldBlock>
      </div>

      <div className="mt-2">
        <FieldBlock label="Purpose" htmlFor={`po-line-purpose-${index}`} error={error?.purposeId}>
          <div className="flex items-center gap-2">
            <Select
              id={`po-line-purpose-${index}`}
              value={line.purposeId}
              disabled={disabled || !projectSelected}
              invalid={!!error?.purposeId}
              aria-label={`Purpose for line ${index + 1}`}
              data-testid="po-line-purpose"
              onChange={(e) => onChange({ purposeId: e.target.value })}
            >
              <option value="">
                {projectSelected
                  ? purposesLoading
                    ? "Loading…"
                    : "Select a purpose…"
                  : "Select a project first"}
              </option>
              {purposes.filter((p) => p.isActive || p.id === line.purposeId).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {!disabled && projectSelected && onAddPurpose && (
              <InlineAddPurpose onAdd={onAddPurpose} />
            )}
          </div>
        </FieldBlock>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] uppercase tracking-[0.4px] text-faint"
            aria-live="polite"
          >
            Budget
          </span>
          {budget ? <BudgetBadge status={budget} /> : <span className="text-[12px] text-faint">—</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("font-mono text-[13px] tabular-nums", amount ? "text-foreground" : "text-faint")}>
            {amount ? formatMoney(amount) : "—"}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={onRemove}
              disabled={!canRemove}
              aria-label={`Remove line ${index + 1}`}
              data-testid="po-line-remove"
              className="grid h-8 w-8 place-items-center rounded-token text-faint hover:bg-muted hover:text-destructive disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldBlock({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && (
        <p className="text-[12px] text-destructive-ink" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function InlineAddPurpose({ onAdd }: { onAdd: (name: string) => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={() => {
        const name = window.prompt("New purpose name:")?.trim();
        if (name) onAdd(name);
      }}
      data-testid="po-line-purpose-add"
      className="whitespace-nowrap"
    >
      <Plus className="mr-1 h-3 w-3" aria-hidden />
      Add
    </Button>
  );
}
