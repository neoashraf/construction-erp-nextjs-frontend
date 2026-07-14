"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { Inbox, AlertCircle } from "lucide-react";
import { PayableTypeBadge, payableTypeLabel } from "./PayableTypeBadge";
import { AppliedPaymentsDrillIn } from "./AppliedPaymentsDrillIn";
import { useOpenPayables } from "../hooks/useOpenPayables";
import { type OpenPayable, type PartyOption, type PayableType } from "../types";

/**
 * Outstanding view (spec §5 Outstanding + §9). Per-payable Original · Applied ·
 * Outstanding grid over `payment_allocation`, sorted highest-outstanding-first; a
 * row expander opens the applied-payments drill-in from
 * `GET /api/payment/payables/{type}/{id}/applied`, each entry linking to the
 * viewer. Filter bar: party + payable type.
 */
export function OutstandingView({ parties }: { parties: PartyOption[] }) {
  const [partyId, setPartyId] = useState("");
  const [payableType, setPayableType] = useState<"" | PayableType>("");
  const [openRow, setOpenRow] = useState<{ payableType: PayableType; payableId: string } | null>(null);

  const filter = {
    partyId: partyId || undefined,
    payableType: payableType || undefined,
  };
  const query = useOpenPayables(filter);
  const rows = (query.data ?? []).slice().sort((a, b) => Number(b.remainingOutstanding) - Number(a.remainingOutstanding));

  return (
    <div className="flex flex-col gap-4" data-testid="payment-outstanding-view">
      <Card className="p-4" data-testid="payment-outstanding-filter-bar">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="op-party">Party</Label>
            <Select
              id="op-party"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              data-testid="payment-outstanding-filter-party"
            >
              <option value="">Any party</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
          <div className="min-w-[180px]">
            <Label htmlFor="op-type">Payable type</Label>
            <Select
              id="op-type"
              value={payableType}
              onChange={(e) => setPayableType(e.target.value as "" | PayableType)}
              data-testid="payment-outstanding-filter-type"
            >
              <option value="">Any</option>
              <option value="PURCHASE_BILL">{payableTypeLabel("PURCHASE_BILL")}</option>
              <option value="LABOUR_PAYABLE">{payableTypeLabel("LABOUR_PAYABLE")}</option>
              <option value="SALARY">{payableTypeLabel("SALARY")}</option>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              setPartyId("");
              setPayableType("");
            }}
            data-testid="payment-outstanding-clear"
            className="ml-auto"
          >
            Clear
          </Button>
        </div>
      </Card>

      {query.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : query.isError ? (
        <Card className="p-8" data-testid="payment-outstanding-error">
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load open payables. Please try again."
            action={
              <Button size="md" onClick={() => query.refetch()} data-testid="payment-outstanding-retry">
                Retry
              </Button>
            }
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-8" data-testid="payment-outstanding-empty">
          <EmptyState
            icon={Inbox}
            title="No open payables to show."
            description="Every posted payable in this filter has been fully settled."
          />
        </Card>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface" data-testid="payment-outstanding-list">
          <div className={cn(OS_GRID, "bg-surface-2 py-3 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground")}>
            <span className="pl-4">Payable ref</span>
            <span>Type</span>
            <span>Date</span>
            <span className="pr-4 text-right">Original</span>
            <span className="pr-4 text-right">Applied</span>
            <span className="pr-4 text-right">Outstanding</span>
            <span />
          </div>
          {rows.map((r) => (
            <OpenPayableRow
              key={`${r.payableType}:${r.payableId}`}
              row={r}
              expanded={
                !!openRow &&
                openRow.payableType === r.payableType &&
                openRow.payableId === r.payableId
              }
              onToggle={() =>
                setOpenRow(
                  openRow &&
                    openRow.payableType === r.payableType &&
                    openRow.payableId === r.payableId
                    ? null
                    : { payableType: r.payableType, payableId: r.payableId },
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OpenPayableRow({
  row,
  expanded,
  onToggle,
}: {
  row: OpenPayable;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <div
        className={cn(OS_GRID, "items-center border-t border-border py-3.5 text-[13px] text-foreground hover:bg-surface-2")}
        role="row"
        data-testid={`payment-outstanding-row-${row.payableId}`}
      >
        <span className="pl-4 font-mono font-semibold text-accent-ink [overflow-wrap:anywhere]">
          {row.reference}
        </span>
        <span>
          <PayableTypeBadge type={row.payableType} />
        </span>
        <span className="font-mono text-[12.5px] tabular-nums text-muted-foreground">{formatDate(row.payableDate)}</span>
        <span className="pr-4 text-right font-mono tabular-nums text-foreground">{formatMoney(row.originalAmount)}</span>
        <span className="pr-4 text-right font-mono tabular-nums text-muted-foreground">{formatMoney(row.appliedAmount)}</span>
        <span
          className="pr-4 text-right font-mono font-semibold tabular-nums text-foreground"
          aria-label={`Outstanding ${row.remainingOutstanding} taka`}
        >
          {formatMoney(row.remainingOutstanding)}
        </span>
        <span className="pr-4 text-right">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 rounded-token border border-border-strong bg-background px-2.5 py-1 text-[11.5px] font-semibold text-foreground hover:bg-surface-2"
            data-testid={`payment-outstanding-expand-${row.payableId}`}
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} aria-hidden />
            {expanded ? "Hide" : "View payments"}
          </button>
        </span>
      </div>
      {expanded && (
        <AppliedPaymentsDrillIn payableType={row.payableType} payableId={row.payableId} />
      )}
    </>
  );
}

const OS_GRID = "grid grid-cols-[1.6fr_0.6fr_0.9fr_1fr_1fr_1fr_1fr] gap-2";
