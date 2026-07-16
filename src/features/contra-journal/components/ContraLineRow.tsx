"use client";

import { Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type AccountOption } from "../api/masters";
import { type ContraLineValues, type LineErrors } from "../schemas/contra.schema";

/**
 * One line of the contra editor grid (spec §5; design "Contra Voucher.dc.html").
 * Account picker is pre-filtered to bank/cash accounts + always shows whatever
 * account is already picked (for the "(inactive — replace before posting)" partial
 * state). Debit/credit are mutually exclusive — typing one clears the other.
 * Below `md` the row becomes a stacked card (design's mobile "Dr/Cr Line N" frame)
 * instead of squeezing a 6-column grid into a narrow viewport — the two variants
 * are parallel DOM subtrees (CSS `hidden`/`md:*`, not JS media-query gated), so
 * each field's `data-testid` carries a `-desktop`/`-mobile` suffix to stay unique;
 * `contra-line-<field>-<key>` (no suffix) remains an alias on the desktop copy for
 * callers that only need "the" field.
 */
export function ContraLineRow({
  line,
  lineNo,
  errors,
  bankCashAccounts,
  allAccountsIndex,
  disabled,
  canRemove,
  onChange,
  onRemove,
}: {
  line: ContraLineValues;
  lineNo: number;
  errors?: LineErrors;
  bankCashAccounts: AccountOption[];
  allAccountsIndex: Map<string, AccountOption>;
  disabled: boolean;
  canRemove: boolean;
  onChange: (p: Partial<ContraLineValues>) => void;
  onRemove: () => void;
}) {
  // Always retain the currently-picked account in the options — even if it fell off the
  // bank/cash filter (deactivated / reclassified) — so the row keeps rendering it and
  // the user can replace it.
  const picked = line.accountId ? allAccountsIndex.get(line.accountId) : undefined;
  const options = [...bankCashAccounts];
  if (picked && !options.some((a) => a.id === picked.id)) options.unshift(picked);
  const inactive =
    picked && (!picked.isActive || (!picked.isBankCash && picked.type === "ASSET" === false));
  const side: "Dr" | "Cr" = line.credit ? "Cr" : "Dr";

  function accountField(variant: "desktop" | "mobile") {
    const testId = variant === "desktop" ? `contra-line-account-${line.key}` : `contra-line-account-${line.key}-mobile`;
    return (
      <div>
        <Select
          value={line.accountId}
          onChange={(e) => onChange({ accountId: e.target.value })}
          invalid={!!errors?.accountId}
          disabled={disabled}
          data-testid={testId}
          aria-label="Account"
        >
          <option value="">Choose a bank or cash account…</option>
          {options.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} · {a.name}
              {picked?.id === a.id && !a.isActive ? " (inactive — replace before posting)" : ""}
            </option>
          ))}
        </Select>
        {errors?.accountId && (
          <p role="alert" className="mt-1 text-[11.5px] font-medium text-destructive" data-testid={`contra-line-account-err-${line.key}${variant === "mobile" ? "-mobile" : ""}`}>
            {errors.accountId}
          </p>
        )}
        {inactive && !errors?.accountId && (
          <p className="mt-1 text-[11.5px] text-warning-ink">Inactive — replace before posting.</p>
        )}
        {picked && !errors?.accountId && !inactive && (
          <p className="mt-1 text-[11px] uppercase tracking-[0.4px] text-faint">
            {picked.type} · {picked.isBankCash ? "Bank/Cash" : ""}
          </p>
        )}
      </div>
    );
  }

  function debitField(variant: "desktop" | "mobile") {
    const testId = variant === "desktop" ? `contra-line-debit-${line.key}` : `contra-line-debit-${line.key}-mobile`;
    return (
      <MoneyInput
        value={line.debit}
        onChange={(e) => onChange({ debit: e.target.value, credit: e.target.value ? "" : line.credit })}
        invalid={!!errors?.debit}
        disabled={disabled}
        aria-label="Debit"
        aria-describedby={`contra-line-mutex-${line.key}`}
        data-testid={testId}
        className="text-right"
      />
    );
  }
  function creditField(variant: "desktop" | "mobile") {
    const testId = variant === "desktop" ? `contra-line-credit-${line.key}` : `contra-line-credit-${line.key}-mobile`;
    return (
      <MoneyInput
        value={line.credit}
        onChange={(e) => onChange({ credit: e.target.value, debit: e.target.value ? "" : line.debit })}
        invalid={!!errors?.credit}
        disabled={disabled}
        aria-label="Credit"
        aria-describedby={`contra-line-mutex-${line.key}`}
        data-testid={testId}
        className="text-right"
      />
    );
  }
  function narrationField(variant: "desktop" | "mobile") {
    const testId = variant === "desktop" ? `contra-line-narration-${line.key}` : `contra-line-narration-${line.key}-mobile`;
    return (
      <Input
        value={line.narration}
        onChange={(e) => onChange({ narration: e.target.value })}
        disabled={disabled}
        placeholder="Line narration (optional)"
        aria-label="Line narration"
        data-testid={testId}
      />
    );
  }
  function removeButton(variant: "desktop" | "mobile") {
    const testId = variant === "desktop" ? `contra-line-remove-${line.key}` : `contra-line-remove-${line.key}-mobile`;
    return (
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled || !canRemove}
        aria-label="Remove line"
        title={canRemove ? "Remove line" : "Minimum of 2 lines"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-token text-muted-foreground hover:bg-destructive-soft hover:text-destructive-ink disabled:opacity-40"
        data-testid={testId}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    );
  }
  const amountError = (errors?.debit || errors?.credit) && (
    <p role="alert" className="text-[11.5px] font-medium text-destructive" data-testid={`contra-line-amount-err-${line.key}`}>
      {errors.debit ?? errors.credit}
    </p>
  );

  return (
    <div role="row" data-testid={`contra-line-${line.key}`}>
      {/* <md stacked card */}
      <div className="flex flex-col gap-3 border-b border-border py-3 last:border-b-0 md:hidden">
        <div className="flex items-center justify-between">
          <Badge tone={side === "Dr" ? "info" : "success"}>{side} · Line {lineNo}</Badge>
          {removeButton("mobile")}
        </div>
        {accountField("mobile")}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] normal-case tracking-normal">Debit</Label>
            <div className="mt-1">{debitField("mobile")}</div>
          </div>
          <div>
            <Label className="text-[10px] normal-case tracking-normal">Credit</Label>
            <div className="mt-1">{creditField("mobile")}</div>
          </div>
        </div>
        {narrationField("mobile")}
        {amountError}
      </div>

      {/* >=md grid row */}
      <div className={cn("hidden items-start gap-2 border-b border-border py-3 last:border-b-0 md:grid", "grid-cols-[24px_1.8fr_1fr_1fr_1.2fr_auto]")}>
        <span className="pt-2 text-[12.5px] text-muted-foreground" aria-hidden>{lineNo}</span>
        {accountField("desktop")}
        {debitField("desktop")}
        {creditField("desktop")}
        {narrationField("desktop")}
        {removeButton("desktop")}
        {amountError && <div className="col-span-6 -mt-2">{amountError}</div>}
      </div>
    </div>
  );
}
