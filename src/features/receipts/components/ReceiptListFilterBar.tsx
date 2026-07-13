"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { parseDate } from "@/lib/format";
import { type CustomerOption, type ProjectOption, type ReceiptStatus } from "../types";
import { paymentModeLabel } from "./PaymentModeTag";

export interface ReceiptFilterValues {
  entryNo: string;
  receiptType: string; // "" | IPC_LINKED | GENERAL
  customerId: string;
  status: ReceiptStatus[];
  projectId: string;
  ipcId: string; // deep-link only — echoed, not manually pickable (API contract 11)
  dateFrom: string; // DD/MM/YYYY
  dateTo: string;
  paymentMode: Array<"CASH" | "MFS" | "BANK_TRANSFER" | "CHEQUE">;
}

export const EMPTY_RECEIPT_FILTER: ReceiptFilterValues = {
  entryNo: "",
  receiptType: "",
  customerId: "",
  status: [],
  projectId: "",
  ipcId: "",
  dateFrom: "",
  dateTo: "",
  paymentMode: [],
};

const STATUS_OPTIONS: {
  key: ReceiptStatus;
  label: string;
  tone: "warning" | "success" | "neutral";
}[] = [
  { key: "DRAFT", label: "Draft", tone: "warning" },
  { key: "POSTED", label: "Posted", tone: "success" },
  { key: "CANCELLED", label: "Cancelled", tone: "neutral" },
];

const MODE_OPTIONS: Array<"BANK_TRANSFER" | "CASH" | "MFS" | "CHEQUE"> = [
  "BANK_TRANSFER",
  "CASH",
  "MFS",
  "CHEQUE",
];

const TONE_ACTIVE: Record<"warning" | "success" | "neutral" | "accent", string> = {
  warning: "border-warning bg-warning-soft text-warning-ink",
  success: "border-success bg-success-soft text-success-ink",
  neutral: "border-border-strong bg-muted text-foreground",
  accent: "border-accent bg-accent-soft text-accent-ink",
};
const DOT_TONE: Record<"warning" | "success" | "neutral" | "accent", string> = {
  warning: "bg-warning",
  success: "bg-success",
  neutral: "bg-muted-foreground",
  accent: "bg-accent-ink",
};

function ToggleChip({
  active,
  tone,
  label,
  dot,
  onClick,
  testId,
}: {
  active: boolean;
  tone: "warning" | "success" | "neutral" | "accent";
  label: string;
  dot?: boolean;
  onClick: () => void;
  testId: string;
}) {
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
          ? TONE_ACTIVE[tone]
          : "border-border-strong bg-background text-muted-foreground hover:bg-surface-2",
      )}
    >
      {active && tone === "accent" ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : dot ? (
        <span className={cn("h-1.5 w-1.5 rounded-full", DOT_TONE[tone])} aria-hidden />
      ) : null}
      {label}
    </button>
  );
}

/**
 * Receipt list filter bar (brief §Scope 4; spec §4/§7/§9; design file `Receipts.dc.html`
 * frames 1/4). Primary row: receipt-number search, type, customer, status (multi-select
 * chips) + "Filters" disclosure + Apply/Clear. Secondary (behind "Filters"): project,
 * financial year, the IPC deep-link echo, date range, payment mode (multi-select
 * chips). All AND-combined server-side query params (API contract 11). Client-side
 * validates `dateFrom > dateTo` before firing (spec §7's exact inline message).
 */
export function ReceiptListFilterBar({
  applied,
  projects,
  customers,
  fyLabel,
  offline,
  onApply,
  onClear,
}: {
  applied: ReceiptFilterValues;
  projects: ProjectOption[];
  customers: CustomerOption[];
  fyLabel: string;
  offline: boolean;
  onApply: (f: ReceiptFilterValues) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<ReceiptFilterValues>(applied);
  const [moreOpen, setMoreOpen] = useState(
    !!(
      applied.projectId ||
      applied.dateFrom ||
      applied.dateTo ||
      applied.paymentMode.length > 0 ||
      applied.ipcId
    ),
  );
  const [dateError, setDateError] = useState<string | null>(null);

  const secondaryCount =
    (draft.projectId ? 1 : 0) +
    (draft.dateFrom || draft.dateTo ? 1 : 0) +
    (draft.paymentMode.length > 0 ? 1 : 0);

  function patch(p: Partial<ReceiptFilterValues>) {
    setDraft((prev) => ({ ...prev, ...p }));
  }
  function toggleStatus(key: ReceiptStatus) {
    patch({
      status: draft.status.includes(key)
        ? draft.status.filter((s) => s !== key)
        : [...draft.status, key],
    });
  }
  function toggleMode(key: "CASH" | "MFS" | "BANK_TRANSFER" | "CHEQUE") {
    patch({
      paymentMode: draft.paymentMode.includes(key)
        ? draft.paymentMode.filter((m) => m !== key)
        : [...draft.paymentMode, key],
    });
  }

  function apply() {
    if (draft.dateFrom && draft.dateTo) {
      try {
        const from = parseDate(draft.dateFrom);
        const to = parseDate(draft.dateTo);
        if (from > to) {
          setDateError("Date from cannot be after date to.");
          return;
        }
      } catch {
        // an incomplete/partial date is left for the caller — no request fires with a bad date
      }
    }
    setDateError(null);
    onApply(draft);
  }
  function clear() {
    setDraft(EMPTY_RECEIPT_FILTER);
    setMoreOpen(false);
    setDateError(null);
    onClear();
  }

  const activeCustomers = customers.filter((c) => c.isActive || c.id === draft.customerId);
  const openProjects = projects.filter((p) => p.status !== "CLOSED" || p.id === draft.projectId);

  return (
    <Card className="p-4" data-testid="receipt-filter-bar">
      <div className="flex flex-wrap items-end gap-2">
        <div className="hidden min-w-[200px] flex-1 flex-col gap-1.5 md:flex">
          <Label htmlFor="receipt-filter-entryno">Receipt number</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
              aria-hidden
            />
            <Input
              id="receipt-filter-entryno"
              type="search"
              className="pl-9 font-mono"
              placeholder="Search by receipt number"
              value={draft.entryNo}
              onChange={(e) => patch({ entryNo: e.target.value })}
              data-testid="receipt-filter-entryno"
            />
          </div>
        </div>

        <div className="flex min-w-[140px] flex-col gap-1.5">
          <Label htmlFor="receipt-filter-type">Type</Label>
          <Select
            id="receipt-filter-type"
            value={draft.receiptType}
            onChange={(e) => patch({ receiptType: e.target.value })}
            data-testid="receipt-filter-type"
          >
            <option value="">All types</option>
            <option value="IPC_LINKED">IPC-linked</option>
            <option value="GENERAL">General</option>
          </Select>
        </div>

        <div className="hidden min-w-[170px] flex-col gap-1.5 md:flex">
          <Label htmlFor="receipt-filter-customer">Customer</Label>
          <Select
            id="receipt-filter-customer"
            value={draft.customerId}
            onChange={(e) => patch({ customerId: e.target.value })}
            data-testid="receipt-filter-customer"
          >
            <option value="">All customers</option>
            {activeCustomers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label id="receipt-filter-status-label">Status</Label>
          <div role="group" aria-labelledby="receipt-filter-status-label" className="flex gap-1.5">
            {STATUS_OPTIONS.map((s) => (
              <ToggleChip
                key={s.key}
                active={draft.status.includes(s.key)}
                tone={s.tone}
                label={s.label}
                dot
                onClick={() => toggleStatus(s.key)}
                testId={`receipt-filter-status-${s.key}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            className="hidden gap-1.5 md:inline-flex"
            aria-expanded={moreOpen}
            aria-controls="receipt-filter-secondary"
            onClick={() => setMoreOpen((o) => !o)}
            data-testid="receipt-filter-toggle"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
            {secondaryCount > 0 && (
              <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-accent-soft px-1 text-[10.5px] font-bold text-accent-ink">
                {secondaryCount}
              </span>
            )}
          </Button>
          <Button
            type="button"
            size="md"
            onClick={apply}
            disabled={offline}
            data-testid="receipt-filter-apply"
          >
            Apply
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={clear}
            data-testid="receipt-filter-clear"
          >
            Clear filters
          </Button>
        </div>
      </div>

      {moreOpen && (
        <div
          id="receipt-filter-secondary"
          className="mt-3 grid gap-3 border-t border-border pt-3 md:grid-cols-3"
          data-testid="receipt-filter-secondary"
        >
          <div>
            <Label htmlFor="receipt-filter-project">Project</Label>
            <Select
              id="receipt-filter-project"
              value={draft.projectId}
              onChange={(e) => patch({ projectId: e.target.value })}
              data-testid="receipt-filter-project"
            >
              <option value="">All projects</option>
              {openProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="receipt-filter-fy">Financial year</Label>
            <Select
              id="receipt-filter-fy"
              defaultValue="active"
              disabled
              aria-readonly
              data-testid="receipt-filter-fy"
            >
              <option value="active">{fyLabel || "Active FY"}</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="receipt-filter-ipc">IPC · deep-link</Label>
            <Input
              id="receipt-filter-ipc"
              className="font-mono"
              value={draft.ipcId}
              readOnly
              disabled={!draft.ipcId}
              placeholder="Not filtered"
              data-testid="receipt-filter-ipc"
            />
          </div>

          <div>
            <Label htmlFor="receipt-filter-from">Date from</Label>
            <DatePickerInput
              id="receipt-filter-from"
              data-testid="receipt-filter-from"
              value={draft.dateFrom}
              onChange={(v) => patch({ dateFrom: v })}
              invalid={!!dateError}
              aria-describedby={dateError ? "receipt-filter-date-error" : undefined}
            />
          </div>
          <div>
            <Label htmlFor="receipt-filter-to">Date to</Label>
            <DatePickerInput
              id="receipt-filter-to"
              data-testid="receipt-filter-to"
              value={draft.dateTo}
              onChange={(v) => patch({ dateTo: v })}
              invalid={!!dateError}
            />
          </div>

          <div>
            <Label id="receipt-filter-mode-label">Payment mode</Label>
            <div
              role="group"
              aria-labelledby="receipt-filter-mode-label"
              className="flex flex-wrap gap-1.5"
            >
              {MODE_OPTIONS.map((m) => (
                <ToggleChip
                  key={m}
                  active={draft.paymentMode.includes(m)}
                  tone="accent"
                  label={paymentModeLabel(m)}
                  onClick={() => toggleMode(m)}
                  testId={`receipt-filter-mode-${m}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {dateError && (
        <p
          id="receipt-filter-date-error"
          className="mt-2 text-[11.5px] text-destructive-ink"
          data-testid="receipt-filter-date-error"
        >
          {dateError}
        </p>
      )}
    </Card>
  );
}
