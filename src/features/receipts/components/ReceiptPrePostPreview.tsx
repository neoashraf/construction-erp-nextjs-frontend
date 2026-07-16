"use client";

import { Check } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { derivedCashReceived } from "../schemas/receipt.schema";
import { type ReceiptFormValues } from "../schemas/receipt.schema";
import { type AccountOption, type CustomerOption } from "../types";

/** A well-known-code lookup for the two IPC-linked posting accounts (REC's ledger effect;
 * mirrors backend `well-known-receipt-accounts.ts` — Phase-1 identifies these by CoA `code`). */
const ACCOUNTS_RECEIVABLE_CODE = "1200";
const TDS_RECOVERABLE_CODE = "1220";

interface PreviewLine {
  side: "Dr" | "Cr";
  label: string;
  sub?: string;
  amount: string;
}

function accountLabel(a: AccountOption | undefined, fallbackId: string): string {
  if (!a) return fallbackId ? `${fallbackId.slice(0, 8)}… (unresolved)` : "Choose an account…";
  return `${a.code} · ${a.name}`;
}

/**
 * Client-derived "what will post" preview (design file `Receipt Editor.dc.html` frame 1
 * "Pre-post preview" panel). Mirrors `buildReceiptCommand` (receipt-posting.ts §4.1/§4.2)
 * line-for-line so the figures the user sees before Post match what the server actually
 * writes — never re-implements posting logic beyond this read-only mirror, and the server
 * remains authoritative (this is a UX preview, not a substitute for `PostingService`).
 */
export function ReceiptPrePostPreview({
  values,
  accounts,
  customers,
}: {
  values: ReceiptFormValues;
  accounts: AccountOption[];
  customers: CustomerOption[];
}) {
  const settled = values.amountSettled || "0";
  if (Number(settled) <= 0 && !values.depositAccountId) return null;

  const depositAccount = accounts.find((a) => a.id === values.depositAccountId);
  const lines: PreviewLine[] = [];

  if (values.receiptType === "IPC_LINKED") {
    const cashReceived = derivedCashReceived(values);
    const tds = values.taxDeductedAtSource || "0";
    const customer = customers.find((c) => c.id === values.customerId);
    const arAccount = accounts.find((a) => a.code === ACCOUNTS_RECEIVABLE_CODE);
    const tdsAccount = accounts.find((a) => a.code === TDS_RECOVERABLE_CODE);

    if (Number(cashReceived) > 0) {
      lines.push({ side: "Dr", label: accountLabel(depositAccount, values.depositAccountId), amount: cashReceived });
    }
    if (Number(tds) > 0) {
      lines.push({ side: "Dr", label: accountLabel(tdsAccount, ""), amount: tds });
    }
    lines.push({
      side: "Cr",
      label: accountLabel(arAccount, ""),
      sub: customer?.name,
      amount: settled,
    });
  } else if (values.receiptType === "GENERAL") {
    const targetAccount = accounts.find((a) => a.id === values.generalTargetAccountId);
    const party = customers.find((c) => c.id === values.partyId);
    const isControl = targetAccount?.type === "LIABILITY";

    lines.push({ side: "Dr", label: accountLabel(depositAccount, values.depositAccountId), amount: settled });
    lines.push({
      side: "Cr",
      label: accountLabel(targetAccount, values.generalTargetAccountId),
      sub: isControl ? party?.name : undefined,
      amount: settled,
    });
  } else {
    return null;
  }

  const totalDebit = lines.filter((l) => l.side === "Dr").reduce((sum, l) => sum + Number(l.amount || 0), 0);
  const totalCredit = lines.filter((l) => l.side === "Cr").reduce((sum, l) => sum + Number(l.amount || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.0001 && totalDebit > 0;

  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm" data-testid="receipt-preview">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-foreground">Pre-post preview</h3>
        <span className="text-[10.5px] text-faint">the lines that will post</span>
      </div>
      <div className="flex flex-col gap-3">
        {lines.map((l, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span
              className={
                "grid h-5 w-7 shrink-0 place-items-center rounded-token text-[10.5px] font-bold " +
                (l.side === "Dr" ? "bg-info-soft text-info" : "bg-accent-soft text-accent-ink")
              }
              aria-hidden
            >
              {l.side}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] text-foreground">{l.label}</div>
              {l.sub && <div className="truncate text-[11px] text-muted-foreground">{l.sub}</div>}
            </div>
            <span className="shrink-0 font-mono text-[12.5px] tabular-nums text-foreground">
              {formatMoney(l.amount)}
            </span>
          </div>
        ))}
      </div>
      {balanced && (
        <div
          className="mt-3 flex items-center gap-1.5 rounded-token bg-success-soft px-3 py-2 text-[12px] font-semibold text-success-ink"
          data-testid="receipt-preview-balanced"
        >
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Balanced — Dr {formatMoney(String(totalDebit))} = Cr {formatMoney(String(totalCredit))}
        </div>
      )}
    </div>
  );
}
