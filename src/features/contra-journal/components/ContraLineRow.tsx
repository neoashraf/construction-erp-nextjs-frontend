"use client";

import { Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type AccountOption } from "../api/masters";
import { type ContraLineValues, type LineErrors } from "../schemas/contra.schema";

/**
 * One line of the contra editor grid (spec §5). Account picker is pre-filtered to
 * bank/cash accounts + always shows whatever account is already picked (for the
 * "(inactive — replace before posting)" partial state). Debit/credit are mutually
 * exclusive — typing one clears the other.
 */
export function ContraLineRow({
  line,
  errors,
  bankCashAccounts,
  allAccountsIndex,
  disabled,
  canRemove,
  onChange,
  onRemove,
}: {
  line: ContraLineValues;
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

  return (
    <div
      className={cn(
        "grid grid-cols-[1.8fr_1fr_1fr_1.2fr_auto] items-start gap-2 border-b border-border py-3 last:border-b-0",
      )}
      role="row"
      data-testid={`contra-line-${line.key}`}
    >
      <div>
        <Select
          value={line.accountId}
          onChange={(e) => onChange({ accountId: e.target.value })}
          invalid={!!errors?.accountId}
          disabled={disabled}
          data-testid={`contra-line-account-${line.key}`}
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
          <p role="alert" className="mt-1 text-[11.5px] font-medium text-destructive" data-testid={`contra-line-account-err-${line.key}`}>
            {errors.accountId}
          </p>
        )}
        {inactive && !errors?.accountId && (
          <p className="mt-1 text-[11.5px] text-warning-ink">Inactive — replace before posting.</p>
        )}
      </div>
      <MoneyInput
        value={line.debit}
        onChange={(e) => onChange({ debit: e.target.value, credit: e.target.value ? "" : line.credit })}
        invalid={!!errors?.debit}
        disabled={disabled}
        aria-label="Debit"
        aria-describedby={`contra-line-mutex-${line.key}`}
        data-testid={`contra-line-debit-${line.key}`}
        className="text-right"
      />
      <MoneyInput
        value={line.credit}
        onChange={(e) => onChange({ credit: e.target.value, debit: e.target.value ? "" : line.debit })}
        invalid={!!errors?.credit}
        disabled={disabled}
        aria-label="Credit"
        aria-describedby={`contra-line-mutex-${line.key}`}
        data-testid={`contra-line-credit-${line.key}`}
        className="text-right"
      />
      <Input
        value={line.narration}
        onChange={(e) => onChange({ narration: e.target.value })}
        disabled={disabled}
        placeholder="Line narration (optional)"
        aria-label="Line narration"
        data-testid={`contra-line-narration-${line.key}`}
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled || !canRemove}
        aria-label="Remove line"
        title={canRemove ? "Remove line" : "Minimum of 2 lines"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-token text-muted-foreground hover:bg-destructive-soft hover:text-destructive-ink disabled:opacity-40"
        data-testid={`contra-line-remove-${line.key}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
      {(errors?.debit || errors?.credit) && (
        <p id={`contra-line-mutex-${line.key}`} role="alert" className="col-span-5 -mt-2 text-[11.5px] font-medium text-destructive" data-testid={`contra-line-amount-err-${line.key}`}>
          {errors.debit ?? errors.credit}
        </p>
      )}
    </div>
  );
}
