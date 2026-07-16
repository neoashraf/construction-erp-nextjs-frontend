"use client";

import { Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { classifyAccount, type AccountOption } from "../api/masters";
import { type JournalLineErrors, type JournalLineValues } from "../schemas/journal.schema";
import { LineDimensionCluster } from "./LineDimensionCluster";
import { OverBudgetBadge } from "./OverBudgetBadge";

/**
 * One journal line (spec §5; design "Journal Voucher.dc.html"). # · Account ·
 * conditional Dimensions/Party cluster · Debit · Credit · over-budget badge (EXPENSE
 * lines only) · remove, with a line-narration field underneath. The account's
 * classification (EXPENSE/INCOME → project+cost centre+purpose, AR/AP control →
 * party, other balance-sheet → none) drives which cluster renders. Below `md` the
 * row becomes a stacked card (design's mobile "Dr/Cr Line N" frame) instead of
 * squeezing a 7-column grid into a narrow viewport — the two variants are parallel
 * DOM subtrees (CSS `hidden`/`md:*`), so the account/debit/credit/remove fields
 * carry a `-mobile` testid suffix on the stacked-card copy to stay unique; the
 * unsuffixed `contra-line-<field>-<key>` alias stays on the desktop copy.
 */
export function JournalLineRow({
  line,
  lineNo,
  errors,
  accounts,
  disabled,
  canRemove,
  onChange,
  onRemove,
}: {
  line: JournalLineValues;
  lineNo: number;
  errors?: JournalLineErrors;
  accounts: AccountOption[];
  disabled: boolean;
  canRemove: boolean;
  onChange: (p: Partial<JournalLineValues>) => void;
  onRemove: () => void;
}) {
  const accountsIndex = new Map(accounts.map((a) => [a.id, a]));
  const picked = line.accountId ? accountsIndex.get(line.accountId) : undefined;
  const cls = classifyAccount(picked);
  const side: "Dr" | "Cr" = line.credit ? "Cr" : "Dr";

  function accountField(variant: "desktop" | "mobile") {
    const testId = variant === "desktop" ? `journal-line-account-${line.key}` : `journal-line-account-${line.key}-mobile`;
    return (
      <div>
        <Select
          value={line.accountId}
          onChange={(e) => onChange({ accountId: e.target.value })}
          invalid={!!errors?.accountId}
          disabled={disabled}
          aria-label="Account"
          data-testid={testId}
        >
          <option value="">Choose an account…</option>
          {accounts.filter((a) => a.isActive || a.id === line.accountId).map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} · {a.name}
              {!a.isActive ? " (inactive — replace before posting)" : ""}
            </option>
          ))}
        </Select>
        {errors?.accountId && (
          <p role="alert" className="mt-1 text-[11.5px] font-medium text-destructive" data-testid={`journal-line-account-err-${line.key}${variant === "mobile" ? "-mobile" : ""}`}>
            {errors.accountId}
          </p>
        )}
        {picked && (
          <p className="mt-1 text-[11px] uppercase tracking-[0.4px] text-faint">{picked.type}</p>
        )}
      </div>
    );
  }

  function noteField(variant: "desktop" | "mobile") {
    const id = variant === "desktop" ? `journal-line-note-${line.key}` : `journal-line-note-${line.key}-mobile`;
    const testId = variant === "desktop" ? `journal-line-narration-${line.key}` : `journal-line-narration-${line.key}-mobile`;
    return (
      <div>
        <Label htmlFor={id} className="text-[10px] normal-case tracking-normal">
          Line note
        </Label>
        <Input
          id={id}
          className="mt-1"
          value={line.narration}
          onChange={(e) => onChange({ narration: e.target.value })}
          disabled={disabled}
          placeholder="Add a note"
          aria-label="Line narration"
          data-testid={testId}
        />
      </div>
    );
  }

  function dimensionCluster(variant: "desktop" | "mobile") {
    return (
      <LineDimensionCluster
        line={line}
        errors={errors}
        accountsIndex={accountsIndex}
        disabled={disabled}
        onChange={onChange}
        variant={variant}
      />
    );
  }

  function debitField(variant: "desktop" | "mobile") {
    const testId = variant === "desktop" ? `journal-line-debit-${line.key}` : `journal-line-debit-${line.key}-mobile`;
    return (
      <MoneyInput
        value={line.debit}
        onChange={(e) => onChange({ debit: e.target.value, credit: e.target.value ? "" : line.credit })}
        invalid={!!errors?.debit}
        disabled={disabled}
        aria-label="Debit"
        data-testid={testId}
        className="text-right"
      />
    );
  }
  function creditField(variant: "desktop" | "mobile") {
    const testId = variant === "desktop" ? `journal-line-credit-${line.key}` : `journal-line-credit-${line.key}-mobile`;
    return (
      <MoneyInput
        value={line.credit}
        onChange={(e) => onChange({ credit: e.target.value, debit: e.target.value ? "" : line.debit })}
        invalid={!!errors?.credit}
        disabled={disabled}
        aria-label="Credit"
        data-testid={testId}
        className="text-right"
      />
    );
  }

  const overBudget =
    picked?.type === "EXPENSE" && cls === "PL" && line.projectId && line.costCentreId ? (
      <OverBudgetBadge state="NONE" />
    ) : (
      <span className="text-[12px] text-faint">—</span>
    );

  function removeButton(variant: "desktop" | "mobile") {
    const testId = variant === "desktop" ? `journal-line-remove-${line.key}` : `journal-line-remove-${line.key}-mobile`;
    return (
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled || !canRemove}
        aria-label="Remove line"
        className="inline-flex h-9 w-9 items-center justify-center rounded-token text-muted-foreground hover:bg-destructive-soft hover:text-destructive-ink disabled:opacity-40"
        data-testid={testId}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  const amountError = (errors?.debit || errors?.credit) && (
    <p role="alert" className="text-[11.5px] font-medium text-destructive" data-testid={`journal-line-amount-err-${line.key}`}>
      {errors.debit ?? errors.credit}
    </p>
  );

  return (
    <div role="row" data-testid={`journal-line-${line.key}`}>
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
        {dimensionCluster("mobile")}
        {overBudget}
        {noteField("mobile")}
        {amountError}
      </div>

      {/* >=md grid row */}
      <div className={cn("hidden items-start gap-2 border-b border-border py-3 last:border-b-0 md:grid", "grid-cols-[24px_1.6fr_1.4fr_1fr_1fr_0.8fr_auto]")}>
        <span className="pt-2 text-[12.5px] text-muted-foreground" aria-hidden>{lineNo}</span>
        <div>
          {accountField("desktop")}
          <div className="mt-2">{noteField("desktop")}</div>
        </div>
        {dimensionCluster("desktop")}
        {debitField("desktop")}
        {creditField("desktop")}
        <div>{overBudget}</div>
        {removeButton("desktop")}
        {amountError && <div className="col-span-7 -mt-1">{amountError}</div>}
      </div>
    </div>
  );
}
