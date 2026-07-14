"use client";

import { Trash2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { Input } from "@/components/ui/input";
import { classifyAccount, type AccountOption } from "../api/masters";
import { type JournalLineErrors, type JournalLineValues } from "../schemas/journal.schema";
import { LineDimensionCluster } from "./LineDimensionCluster";
import { OverBudgetBadge } from "./OverBudgetBadge";

/**
 * One journal line (spec §5). Account · conditional cluster · debit · credit · over-
 * budget badge (EXPENSE lines only) · narration · remove. The cluster is stacked
 * beneath the line at 1024+ to keep the debit/credit inputs prominent.
 */
export function JournalLineRow({
  line,
  errors,
  accounts,
  disabled,
  canRemove,
  onChange,
  onRemove,
}: {
  line: JournalLineValues;
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
  return (
    <div
      className="border-b border-border py-3 last:border-b-0"
      role="row"
      data-testid={`journal-line-${line.key}`}
    >
      <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr_auto] items-start gap-2">
        <div>
          <Select
            value={line.accountId}
            onChange={(e) => onChange({ accountId: e.target.value })}
            invalid={!!errors?.accountId}
            disabled={disabled}
            aria-label="Account"
            data-testid={`journal-line-account-${line.key}`}
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
            <p role="alert" className="mt-1 text-[11.5px] font-medium text-destructive" data-testid={`journal-line-account-err-${line.key}`}>
              {errors.accountId}
            </p>
          )}
        </div>
        <MoneyInput
          value={line.debit}
          onChange={(e) => onChange({ debit: e.target.value, credit: e.target.value ? "" : line.credit })}
          invalid={!!errors?.debit}
          disabled={disabled}
          aria-label="Debit"
          data-testid={`journal-line-debit-${line.key}`}
          className="text-right"
        />
        <MoneyInput
          value={line.credit}
          onChange={(e) => onChange({ credit: e.target.value, debit: e.target.value ? "" : line.debit })}
          invalid={!!errors?.credit}
          disabled={disabled}
          aria-label="Credit"
          data-testid={`journal-line-credit-${line.key}`}
          className="text-right"
        />
        <Input
          value={line.narration}
          onChange={(e) => onChange({ narration: e.target.value })}
          disabled={disabled}
          placeholder="Line narration (optional)"
          aria-label="Line narration"
          data-testid={`journal-line-narration-${line.key}`}
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled || !canRemove}
          aria-label="Remove line"
          className="inline-flex h-9 w-9 items-center justify-center rounded-token text-muted-foreground hover:bg-destructive-soft hover:text-destructive-ink disabled:opacity-40"
          data-testid={`journal-line-remove-${line.key}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {(errors?.debit || errors?.credit) && (
        <p role="alert" className="mt-1 text-[11.5px] font-medium text-destructive" data-testid={`journal-line-amount-err-${line.key}`}>
          {errors.debit ?? errors.credit}
        </p>
      )}
      <div className="mt-2 flex items-start gap-2">
        <div className="flex-1">
          <LineDimensionCluster
            line={line}
            errors={errors}
            accountsIndex={accountsIndex}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
        {picked?.type === "EXPENSE" && cls === "PL" && line.projectId && line.costCentreId && (
          <OverBudgetBadge state="NONE" />
        )}
      </div>
    </div>
  );
}
