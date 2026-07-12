"use client";

import Decimal from "decimal.js";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, toDecimal } from "@/lib/money";
import { type IpcFormValues } from "../schemas/ipc.schema";

function dec(v: string): Decimal {
  try {
    return toDecimal(v.trim() === "" ? "0" : v);
  } catch {
    return new Decimal(0);
  }
}

interface Dims {
  customerName: string;
  projectLabel: string;
  costCentreLabel: string;
  purposeLabel: string;
}

interface Line {
  side: "Dr" | "Cr";
  account: string;
  amount: Decimal;
  party?: string;
  dims?: string[];
}

/**
 * Illustrative ledger-effect preview (spec §4; design "Ledger effect"). Shows the balanced
 * `SALES_IPC` posting the server will build — Dr AR (currently due) + Dr Retention Receivable +
 * Dr Mobilization Advance + Dr AIT Recoverable; Cr Revenue + Cr Output VAT payable, with the
 * customer party on the control (AR/retention/advance) lines and project + cost_centre + purpose
 * on the revenue/VAT lines (FR-SAL-010). **Preview only** — the editor never asserts balance;
 * LED's `PostingService` is authoritative (this always balances by construction). `settled`
 * relabels it once the IPC is POSTED.
 */
export function LedgerEffectPreview({
  values,
  currentlyDue,
  dims,
  settled,
}: {
  values: IpcFormValues;
  currentlyDue: string;
  dims: Dims;
  settled: boolean;
}) {
  const due = dec(currentlyDue);
  const retention = dec(values.retentionAmount);
  const advance = dec(values.advanceRecoveredAmount);
  const ait = dec(values.aitTdsAmount);
  const certified = dec(values.certifiedAmount);
  const vat = dec(values.outputVatAmount);

  const dimPills = [dims.projectLabel, dims.costCentreLabel, dims.purposeLabel].filter(Boolean);

  const lines: Line[] = ([
    { side: "Dr", account: "Accounts Receivable", amount: due, party: dims.customerName },
    { side: "Dr", account: "Retention Receivable", amount: retention, party: dims.customerName },
    { side: "Dr", account: "Mobilization Advance", amount: advance, party: dims.customerName },
    { side: "Dr", account: "AIT Recoverable", amount: ait, party: dims.customerName },
    { side: "Cr", account: "Revenue — Construction", amount: certified, dims: dimPills },
    { side: "Cr", account: "Output VAT payable", amount: vat, dims: dimPills },
  ] as Line[]).filter((l) => l.amount.greaterThan(0));

  const debit = lines.filter((l) => l.side === "Dr").reduce((a, l) => a.plus(l.amount), new Decimal(0));
  const credit = lines.filter((l) => l.side === "Cr").reduce((a, l) => a.plus(l.amount), new Decimal(0));
  const balanced = debit.equals(credit);

  return (
    <div className="flex flex-col gap-3" data-testid="ipc-ledger-preview">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-foreground">Ledger effect {settled ? "(posted)" : "(preview)"}</h2>
        <span className="text-[11px] text-faint">{settled ? "settled" : "illustrative"}</span>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {lines.map((l, i) => (
          <div key={i} className="flex items-start justify-between gap-3 py-2">
            <div className="flex min-w-0 items-start gap-2">
              <span
                className={cn(
                  "mt-0.5 grid h-5 w-7 flex-none place-items-center rounded-token text-[10px] font-bold",
                  l.side === "Dr" ? "bg-info-soft text-info-ink" : "bg-accent-soft text-accent-ink",
                )}
              >
                {l.side}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground [overflow-wrap:anywhere]">{l.account}</div>
                {l.party && <div className="text-[11.5px] text-muted-foreground [overflow-wrap:anywhere]">{l.party}</div>}
                {l.dims && l.dims.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {l.dims.map((d) => (
                      <span key={d} className="inline-flex items-center rounded-pill bg-accent-soft/70 px-2 py-0.5 text-[10.5px] font-medium text-accent-ink [overflow-wrap:anywhere]">{d}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <span className="whitespace-nowrap pt-0.5 font-mono text-[13px] tabular-nums text-foreground">{formatMoney(l.amount.toFixed(4))}</span>
          </div>
        ))}
      </div>

      <div
        className={cn(
          "flex items-center gap-2 rounded-card px-3 py-2 text-[12.5px] font-medium",
          balanced ? "bg-success-soft text-success-ink" : "bg-destructive-soft text-destructive-ink",
        )}
        data-testid="ipc-ledger-balance"
      >
        {balanced && <Check className="h-4 w-4 flex-none" aria-hidden />}
        <span>
          Debit {formatMoney(debit.toFixed(4))} = Credit {formatMoney(credit.toFixed(4))}
          {balanced ? " — balanced" : " — review figures"}
        </span>
      </div>
    </div>
  );
}
