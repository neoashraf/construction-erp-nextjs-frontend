"use client";

import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type ReportParams } from "../../../types";
import { type ReportTab } from "../types";

/**
 * FE-56 report-specific filter panel (spec §7). Renders alongside the shared
 * `ReportParameterPanel` — the FE-54 panel handles FY/Project/CostCentre/Date
 * range/As-of; this one contributes only the report-specific extras (trial
 * balance groupBy chips, ledger accountId requirement, daybook voucherType,
 * cash-book optional accountId).
 */

interface AccountOption {
  id: string;
  label: string;
  kind?: "CASH_BANK" | "PARTY" | "OTHER";
}

export interface TbLedgerFiltersProps {
  tab: ReportTab;
  value: ReportParams;
  onChange: (next: ReportParams) => void;
  /** Options fed from the mock/backend by the parent (kept opaque for tests). */
  accounts: AccountOption[];
  parties: AccountOption[];
  cashBankAccounts: AccountOption[];
  voucherTypes: { value: string; label: string }[];
  /** Per-tab validation error message (surfaced by the parent). */
  errors?: { accountId?: string; dateFrom?: string };
}

const TB_GROUPBYS: Array<{ value: string; label: string }> = [
  { value: "account", label: "Account" },
  { value: "project", label: "Project" },
  { value: "cost_centre", label: "Cost centre" },
  { value: "purpose", label: "Purpose" },
  { value: "godown", label: "Godown" },
  { value: "party", label: "Party" },
];

export function TbLedgerFilters({
  tab,
  value,
  onChange,
  accounts,
  parties,
  cashBankAccounts,
  voucherTypes,
  errors,
}: TbLedgerFiltersProps) {
  const extras = value.extras ?? {};
  function setExtra(key: string, next: string | null) {
    onChange({ ...value, extras: { ...extras, [key]: next } });
  }

  if (tab === "TB") {
    const groupBy = ((extras.groupBy as string) ?? "account").split(",").filter(Boolean);
    function toggleGroupBy(v: string) {
      const has = groupBy.includes(v);
      const next = has ? groupBy.filter((g) => g !== v) : [...groupBy, v];
      setExtra("groupBy", (next.length > 0 ? next : ["account"]).join(","));
    }
    return (
      <Card className="p-4" data-testid="tb-filters">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Group by
        </Label>
        <div className="mt-2 flex flex-wrap gap-1.5" data-testid="tb-groupby">
          {TB_GROUPBYS.map((g) => {
            const active = groupBy.includes(g.value);
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => toggleGroupBy(g.value)}
                className={cn(
                  "rounded-pill px-2.5 py-1 text-[12px] font-semibold transition-colors",
                  active
                    ? "bg-accent-soft text-accent-ink"
                    : "border border-border-strong text-muted-foreground hover:bg-muted",
                )}
                data-testid={`tb-groupby-${g.value}`}
                aria-pressed={active}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </Card>
    );
  }

  if (tab === "LEDGER") {
    return (
      <Card className="p-4" data-testid="ledger-filters">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="ledger-account">Account (required)</Label>
            <select
              id="ledger-account"
              value={(extras.accountId as string) ?? ""}
              onChange={(e) => setExtra("accountId", e.target.value || null)}
              className={cn(
                "mt-1 block h-9 w-full rounded-token border border-border-strong bg-background px-3 text-sm text-foreground",
                "focus:border-accent focus:shadow-focus focus:outline-none",
                errors?.accountId && "border-destructive focus:shadow-focus-error",
              )}
              data-testid="ledger-accountId"
            >
              <option value="">Select an account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            {errors?.accountId && (
              <p className="mt-1 text-[12px] text-destructive" role="alert">
                {errors.accountId}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="ledger-party">Party (optional)</Label>
            <select
              id="ledger-party"
              value={(extras.partyId as string) ?? ""}
              onChange={(e) => setExtra("partyId", e.target.value || null)}
              className="mt-1 block h-9 w-full rounded-token border border-border-strong bg-background px-3 text-sm text-foreground focus:border-accent focus:shadow-focus focus:outline-none"
              data-testid="ledger-partyId"
            >
              <option value="">All parties</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>
    );
  }

  if (tab === "DAYBOOK") {
    return (
      <Card className="p-4" data-testid="daybook-filters">
        <Label htmlFor="daybook-voucher-type">Voucher type (optional)</Label>
        <select
          id="daybook-voucher-type"
          value={(extras.voucherType as string) ?? ""}
          onChange={(e) => setExtra("voucherType", e.target.value || null)}
          className="mt-1 block h-9 w-64 rounded-token border border-border-strong bg-background px-3 text-sm text-foreground focus:border-accent focus:shadow-focus focus:outline-none"
          data-testid="daybook-voucherType"
        >
          <option value="">All voucher types</option>
          {voucherTypes.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </Card>
    );
  }

  // CASH_BANK
  return (
    <Card className="p-4" data-testid="cash-bank-filters">
      <Label htmlFor="cash-account">Cash / bank account (optional)</Label>
      <select
        id="cash-account"
        value={(extras.accountId as string) ?? ""}
        onChange={(e) => setExtra("accountId", e.target.value || null)}
        className="mt-1 block h-9 w-64 rounded-token border border-border-strong bg-background px-3 text-sm text-foreground focus:border-accent focus:shadow-focus focus:outline-none"
        data-testid="cash-bank-accountId"
      >
        <option value="">All cash & bank accounts</option>
        {cashBankAccounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
    </Card>
  );
}
