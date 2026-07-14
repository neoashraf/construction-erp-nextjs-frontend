"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker";
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
 * Payment list filter bar (brief §Scope 4; spec §7). Primary row: entry number + party
 * + status (chips) + Filters disclosure + Apply / Clear. Secondary (behind "Filters"):
 * payment mode chips, paying account, payable type, date range. All AND-combined
 * server-side query params (contract 13); client-side validates `dateFrom > dateTo`
 * before firing (spec §7 exact inline message).
 */
export function PaymentListFilterBar({
  applied,
  parties,
  accounts,
  offline,
  onApply,
  onClear,
}: {
  applied: PaymentFilterValues;
  parties: PartyOption[];
  accounts: AccountOption[];
  offline: boolean;
  onApply: (values: PaymentFilterValues) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<PaymentFilterValues>(applied);
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <div className="min-w-[160px] flex-1">
          <Label htmlFor="pay-entry-no">Entry no.</Label>
          <Input
            id="pay-entry-no"
            value={draft.entryNo}
            onChange={(e) => patch({ entryNo: e.target.value })}
            placeholder="PAY/2526/…"
            data-testid="payment-filter-entry-no"
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <Label htmlFor="pay-party">Party</Label>
          <Select
            id="pay-party"
            value={draft.partyId}
            onChange={(e) => patch({ partyId: e.target.value })}
            data-testid="payment-filter-party"
          >
            <option value="">Any party</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <div className="flex gap-1.5">
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
            variant="ghost"
            size="md"
            onClick={() => setShowMore((v) => !v)}
            data-testid="payment-filter-more"
            aria-expanded={showMore}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
          </Button>
          <Button variant="ghost" size="md" onClick={clear} data-testid="payment-filter-clear">
            Clear
          </Button>
          <Button size="md" onClick={apply} disabled={offline} data-testid="payment-filter-apply">
            Apply
          </Button>
        </div>
      </div>

      {showMore && (
        <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="payment-filter-more-panel">
          <div>
            <Label>Mode</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {MODE_OPTS.map((m) => (
                <StatusChip
                  key={m}
                  active={draft.paymentMode.includes(m)}
                  label={paymentModeLabel(m)}
                  tone="accent"
                  onClick={() => toggleMode(m)}
                  testId={`payment-filter-mode-${m}`}
                />
              ))}
            </div>
          </div>
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
              className="col-span-full text-[12px] font-medium text-destructive"
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

function StatusChip({
  active,
  tone,
  label,
  onClick,
  testId,
}: {
  active: boolean;
  tone: "warning" | "success" | "neutral" | "accent";
  label: string;
  onClick: () => void;
  testId: string;
}) {
  const activeCls: Record<typeof tone, string> = {
    warning: "border-warning bg-warning-soft text-warning-ink",
    success: "border-success bg-success-soft text-success-ink",
    neutral: "border-border-strong bg-muted text-foreground",
    accent: "border-accent bg-accent-soft text-accent-ink",
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
        active
          ? activeCls[tone]
          : "border-border-strong bg-background text-muted-foreground hover:bg-surface-2",
      )}
    >
      {label}
    </button>
  );
}
