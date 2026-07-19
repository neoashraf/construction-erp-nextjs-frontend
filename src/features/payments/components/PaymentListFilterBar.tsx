"use client";

import { useState } from "react";
import { SlidersHorizontal, ChevronDown, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { paymentModeLabel } from "./PaymentModeBadge";
import { paymentStatusLabel } from "./PaymentStatusBadge";
import { payableTypeLabel } from "./PayableTypeBadge";
import {
  EMPTY_PAYMENT_FILTER,
  validateDateRange,
  type PaymentFilterValues,
} from "../schemas/payment-filters.schema";
import {
  type AccountOption,
  type PartyOption,
  type PayableType,
  type PaymentMode,
  type PaymentStatus,
} from "../types";

const STATUS_OPTS: PaymentStatus[] = ["DRAFT", "POSTED", "CANCELLED"];
const MODE_OPTS: PaymentMode[] = ["CASH", "MFS", "BANK_TRANSFER", "CHEQUE", "RTGS"];
const PAYABLE_OPTS: PayableType[] = ["PURCHASE_BILL", "LABOUR_PAYABLE", "SALARY"];

/**
 * Payment list filter bar (brief §Scope 4; spec §7; design "Payments" frame). Primary
 * row: Party · Payment number · Payment mode (multi-select) · Status (dot chips) +
 * "Filters" disclosure (with active-count) + Apply / Clear filters. Secondary (behind
 * "Filters"): paying account · payable type · financial year (session context, display
 * only) · date range. All AND-combined server-side query params (contract 13);
 * client-side validates `dateFrom > dateTo` before firing (spec §7 exact inline message).
 */
export function PaymentListFilterBar({
  applied,
  parties,
  accounts,
  offline,
  fyLabel,
  onApply,
  onClear,
}: {
  applied: PaymentFilterValues;
  parties: PartyOption[];
  accounts: AccountOption[];
  offline: boolean;
  fyLabel: string;
  onApply: (values: PaymentFilterValues) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<PaymentFilterValues>(applied);
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const secondaryCount =
    (draft.paymentAccountId ? 1 : 0) + (draft.payableType ? 1 : 0) + (draft.dateFrom || draft.dateTo ? 1 : 0);

  function patch(p: Partial<PaymentFilterValues>) {
    setDraft((prev) => ({ ...prev, ...p }));
    setError(null);
  }

  function toggleStatus(s: PaymentStatus) {
    setDraft((prev) => ({
      ...prev,
      status: prev.status.includes(s) ? prev.status.filter((x) => x !== s) : [...prev.status, s],
    }));
  }
  function toggleMode(m: PaymentMode) {
    setDraft((prev) => ({
      ...prev,
      paymentMode: prev.paymentMode.includes(m)
        ? prev.paymentMode.filter((x) => x !== m)
        : [...prev.paymentMode, m],
    }));
  }

  function apply() {
    const err = validateDateRange(draft.dateFrom, draft.dateTo);
    if (err) {
      setError(err.message);
      return;
    }
    onApply(draft);
  }

  function clear() {
    setDraft(EMPTY_PAYMENT_FILTER);
    setError(null);
    onClear();
  }

  return (
    <Card className="p-4" data-testid="payment-filter-bar">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[190px] flex-1">
          <Label htmlFor="pay-party">Party</Label>
          <Select
            id="pay-party"
            value={draft.partyId}
            onChange={(e) => patch({ partyId: e.target.value })}
            data-testid="payment-filter-party"
          >
            <option value="">Select a party</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
        <div className="min-w-[170px] flex-1">
          <Label htmlFor="pay-entry-no">Payment number</Label>
          <Input
            id="pay-entry-no"
            value={draft.entryNo}
            onChange={(e) => patch({ entryNo: e.target.value })}
            placeholder="Search by PAY/…"
            data-testid="payment-filter-entry-no"
          />
        </div>
        <div className="min-w-[190px]">
          <Label id="pay-mode-label">Payment mode</Label>
          <ModeMultiSelect
            selected={draft.paymentMode}
            onToggle={toggleMode}
            labelId="pay-mode-label"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <div className="flex gap-1.5" role="group" aria-label="Status">
            {STATUS_OPTS.map((s) => (
              <StatusChip
                key={s}
                active={draft.status.includes(s)}
                label={paymentStatusLabel(s)}
                tone={s === "DRAFT" ? "warning" : s === "POSTED" ? "success" : "neutral"}
                onClick={() => toggleStatus(s)}
                testId={`payment-filter-status-${s}`}
              />
            ))}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={() => setShowMore((v) => !v)}
            data-testid="payment-filter-more"
            aria-expanded={showMore}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
            {secondaryCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-soft px-1 text-[10.5px] font-bold text-accent-ink">
                {secondaryCount}
              </span>
            )}
          </Button>
          <Button size="md" onClick={apply} disabled={offline} data-testid="payment-filter-apply">
            Apply
          </Button>
          <Button variant="ghost" size="md" onClick={clear} data-testid="payment-filter-clear">
            Clear filters
          </Button>
        </div>
      </div>

      {showMore && (
        <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="payment-filter-more-panel">
          <div>
            <Label htmlFor="pay-account">Paying account</Label>
            <Select
              id="pay-account"
              value={draft.paymentAccountId}
              onChange={(e) => patch({ paymentAccountId: e.target.value })}
              data-testid="payment-filter-account"
            >
              <option value="">Any account</option>
              {accounts.filter((a) => a.isActive && a.type === "ASSET").map((a) => (
                <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="pay-payable-type">Payable type</Label>
            <Select
              id="pay-payable-type"
              value={draft.payableType}
              onChange={(e) => patch({ payableType: e.target.value as PaymentFilterValues["payableType"] })}
              data-testid="payment-filter-payable-type"
            >
              <option value="">Any</option>
              {PAYABLE_OPTS.map((t) => (
                <option key={t} value={t}>{payableTypeLabel(t)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="pay-fy">Financial year</Label>
            <Select id="pay-fy" value={fyLabel} disabled aria-readonly data-testid="payment-filter-fy">
              <option value={fyLabel}>{fyLabel}</option>
            </Select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="pay-date-from">Date from</Label>
              <DatePickerInput
                id="pay-date-from"
                value={draft.dateFrom}
                onChange={(v) => patch({ dateFrom: v })}
                data-testid="payment-filter-date-from"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="pay-date-to">Date to</Label>
              <DatePickerInput
                id="pay-date-to"
                value={draft.dateTo}
                onChange={(v) => patch({ dateTo: v })}
                invalid={!!error}
                data-testid="payment-filter-date-to"
              />
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="col-span-full text-[12px] font-medium text-destructive-ink"
              data-testid="payment-filter-date-err"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

/** Closed multi-select control (design "PAYMENT MODE" pill: summary + count + chevron). */
function ModeMultiSelect({
  selected,
  onToggle,
  labelId,
}: {
  selected: PaymentMode[];
  onToggle: (m: PaymentMode) => void;
  labelId: string;
}) {
  const summary =
    selected.length === 0
      ? "All modes"
      : selected.map(paymentModeLabel).join(", ");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-labelledby={labelId}
        data-testid="payment-filter-mode"
        className="flex h-9 w-full items-center gap-2 rounded-token border border-border-strong bg-background pl-3 pr-2.5 text-sm text-foreground focus:border-accent focus:outline-none focus:shadow-focus"
      >
        <span className={cn("flex-1 truncate text-left", selected.length === 0 && "text-muted-foreground")}>
          {summary}
        </span>
        {selected.length > 0 && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10.5px] font-bold text-muted-foreground">
            {selected.length}
          </span>
        )}
        <ChevronDown className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[200px]" align="start">
        {MODE_OPTS.map((m) => {
          const active = selected.includes(m);
          return (
            <button
              key={m}
              type="button"
              role="menuitemcheckbox"
              aria-checked={active}
              onClick={() => onToggle(m)}
              data-testid={`payment-filter-mode-opt-${m}`}
              className="flex h-[34px] w-full items-center gap-2 rounded-token px-2.5 text-[13px] font-medium text-foreground hover:bg-muted"
            >
              <span
                className={cn(
                  "grid h-4 w-4 flex-none place-items-center rounded-sm border",
                  active ? "border-accent bg-accent text-accent-foreground" : "border-border-strong",
                )}
                aria-hidden
              >
                {active && <Check className="h-3 w-3" />}
              </span>
              {paymentModeLabel(m)}
            </button>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusChip({
  active,
  tone,
  label,
  onClick,
  testId,
}: {
  active: boolean;
  tone: "warning" | "success" | "neutral";
  label: string;
  onClick: () => void;
  testId: string;
}) {
  const activeCls: Record<typeof tone, string> = {
    warning: "border-warning bg-warning-soft text-warning-ink",
    success: "border-success bg-success-soft text-success-ink",
    neutral: "border-border-strong bg-muted text-foreground",
  };
  const dotCls: Record<typeof tone, string> = {
    warning: "bg-warning",
    success: "bg-success",
    neutral: "bg-muted-foreground",
  };
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={active}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-[12.5px] font-medium transition-colors",
        active ? activeCls[tone] : "border-border-strong bg-background text-muted-foreground hover:bg-surface-2",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotCls[tone])} aria-hidden />
      {label}
    </button>
  );
}
