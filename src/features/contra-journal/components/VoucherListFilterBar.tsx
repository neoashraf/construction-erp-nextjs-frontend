"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import {
  EMPTY_VOUCHER_FILTER,
  validateDateRange,
  type VoucherFilterValues,
  type VoucherTypeFilter,
} from "../schemas/voucher-list-filter.schema";
import { type VoucherStatus } from "../types";
import { voucherStatusLabel } from "./VoucherStatusBadge";

const TYPE_CHIPS: { key: VoucherTypeFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "CONTRA", label: "Contra" },
  { key: "JOURNAL", label: "Journal" },
  { key: "OPENING", label: "Opening" },
];
const STATUS_OPTS: VoucherStatus[] = ["DRAFT", "POSTED", "CANCELLED"];

/**
 * Voucher list filter bar (spec §7). Primary row: type chips + status chips + Filters
 * disclosure + Apply / Clear. Secondary: date range + entry number. `dateFrom >
 * dateTo` is a client pre-check with the exact inline copy.
 */
export function VoucherListFilterBar({
  applied,
  offline,
  onApply,
  onClear,
}: {
  applied: VoucherFilterValues;
  offline: boolean;
  onApply: (v: VoucherFilterValues) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<VoucherFilterValues>(applied);
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(p: Partial<VoucherFilterValues>) {
    setDraft((prev) => ({ ...prev, ...p }));
    setError(null);
  }
  function toggleStatus(s: VoucherStatus) {
    setDraft((prev) => ({
      ...prev,
      status: prev.status.includes(s) ? prev.status.filter((x) => x !== s) : [...prev.status, s],
    }));
  }
  function apply() {
    const err = validateDateRange(draft.dateFrom, draft.dateTo);
    if (err) {
      setError(err);
      return;
    }
    onApply(draft);
  }
  function clear() {
    setDraft(EMPTY_VOUCHER_FILTER);
    setError(null);
    onClear();
  }

  return (
    <Card className="p-4" data-testid="voucher-filter-bar">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Type</Label>
          <div className="mt-1 flex gap-1.5" role="group" aria-label="Voucher type filter">
            {TYPE_CHIPS.map((t) => {
              const active = draft.type === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => patch({ type: t.key })}
                  data-testid={`voucher-filter-type-${t.key}`}
                  className={cn(
                    "inline-flex h-8 items-center rounded-pill border px-3 text-[12.5px] font-semibold transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border-strong bg-background text-muted-foreground hover:bg-surface-2",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label>Status</Label>
          <div className="mt-1 flex gap-1.5">
            {STATUS_OPTS.map((s) => {
              const active = draft.status.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  role="checkbox"
                  aria-checked={active}
                  onClick={() => toggleStatus(s)}
                  data-testid={`voucher-filter-status-${s}`}
                  className={cn(
                    "inline-flex h-8 items-center rounded-pill border px-3 text-[12.5px] font-semibold transition-colors",
                    active
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-border-strong bg-background text-muted-foreground hover:bg-surface-2",
                  )}
                >
                  {voucherStatusLabel(s)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="min-w-[180px] flex-1">
          <Label htmlFor="voucher-entry-no">Entry no.</Label>
          <Input
            id="voucher-entry-no"
            value={draft.entryNo}
            onChange={(e) => patch({ entryNo: e.target.value })}
            placeholder="POSTED only"
            data-testid="voucher-filter-entry-no"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="md"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            data-testid="voucher-filter-more"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
          </Button>
          <Button variant="ghost" size="md" onClick={clear} data-testid="voucher-filter-clear">
            Clear filters
          </Button>
          <Button size="md" onClick={apply} disabled={offline} data-testid="voucher-filter-apply">
            Apply
          </Button>
        </div>
      </div>

      {showMore && (
        <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-[1fr_1fr]" data-testid="voucher-filter-more-panel">
          <div>
            <Label htmlFor="voucher-date-from">Date from</Label>
            <DatePickerInput
              id="voucher-date-from"
              value={draft.dateFrom}
              onChange={(v) => patch({ dateFrom: v })}
              data-testid="voucher-filter-date-from"
            />
          </div>
          <div>
            <Label htmlFor="voucher-date-to">Date to</Label>
            <DatePickerInput
              id="voucher-date-to"
              value={draft.dateTo}
              onChange={(v) => patch({ dateTo: v })}
              invalid={!!error}
              data-testid="voucher-filter-date-to"
            />
          </div>
          {error && (
            <p role="alert" className="col-span-full text-[12px] font-medium text-destructive" data-testid="voucher-filter-date-err">
              {error}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
