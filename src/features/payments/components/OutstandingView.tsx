"use client";

import { useEffect, useState } from "react";
import { ChevronDown, CheckCircle2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { PayableTypeBadge, payableTypeLabel } from "./PayableTypeBadge";
import { AppliedPaymentsDrillIn } from "./AppliedPaymentsDrillIn";
import { useOpenPayables } from "../hooks/useOpenPayables";
import { type OpenPayable, type PartyOption, type PayableType } from "../types";

// 8 tracks: Payable ref · Type · Party · Original · Applied · Outstanding · Date · actions.
// Proportioned after the design file's `outCols` (Payments.dc.html), scaled down by the
// 8px grid gap this build uses where the design put the spacing inside each cell — so the
// row still fits the ~970px content column at 1280 without a horizontal scrollbar.
// FIXED money tracks are the point: an all-flex grid let "OUTSTANDING ৳" + its sort caret
// spill out of its column and collide with "DATE".
const GRID = "128px 112px minmax(120px,1.3fr) 104px 96px 118px 84px 128px";
const MONEY = "font-mono text-[13px] tabular-nums";

function money(v: string) {
  return formatMoney(v, { fractionDigits: 2 });
}

/**
 * Outstanding view (spec §5 Outstanding + §9; design "Payments" Outstanding frame).
 * Per-payable Original · Applied · Outstanding grid over `payment_allocation`, sorted
 * highest-outstanding-first; a "View payments" expander opens the applied-payments
 * drill-in from `GET /api/payment/payables/{type}/{id}/applied`. Filter bar: party +
 * payable type + Apply / Clear filters. Money is 2-decimal per the design.
 */
export function OutstandingView({
  parties,
  onCount,
  initialPartyId = "",
  initialPayableType = "",
  focusPayableId = "",
}: {
  parties: PartyOption[];
  onCount?: (n: number | null) => void;
  /** Deep-link seeds from the route's query string (spec §9). */
  initialPartyId?: string;
  initialPayableType?: "" | PayableType;
  /** Opens this payable's applied-payments drill-in; an unknown id is simply ignored. */
  focusPayableId?: string;
}) {
  const [draftParty, setDraftParty] = useState(initialPartyId);
  const [draftType, setDraftType] = useState<"" | PayableType>(initialPayableType);
  const [partyId, setPartyId] = useState(initialPartyId);
  const [payableType, setPayableType] = useState<"" | PayableType>(initialPayableType);
  const [openRow, setOpenRow] = useState<{ payableType: PayableType; payableId: string } | null>(
    focusPayableId && initialPayableType
      ? { payableType: initialPayableType, payableId: focusPayableId }
      : null,
  );

  const filter = { partyId: partyId || undefined, payableType: payableType || undefined };
  const query = useOpenPayables(filter);
  const rows = (query.data ?? [])
    .slice()
    .sort((a, b) => Number(b.remainingOutstanding) - Number(a.remainingOutstanding));
  const partyName = (id: string | null) => (id ? parties.find((p) => p.id === id)?.name ?? null : null);

  useEffect(() => {
    onCount?.(query.data ? rows.length : null);
    return () => onCount?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, rows.length]);

  function apply() {
    setPartyId(draftParty);
    setPayableType(draftType);
  }
  function clear() {
    setDraftParty("");
    setDraftType("");
    setPartyId("");
    setPayableType("");
  }

  return (
    <div className="flex flex-col gap-4" data-testid="payment-outstanding-view">
      <Card className="p-4" data-testid="payment-outstanding-filter-bar">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="op-party">Party</Label>
            <Select
              id="op-party"
              value={draftParty}
              onChange={(e) => setDraftParty(e.target.value)}
              data-testid="payment-outstanding-filter-party"
            >
              <option value="">All parties</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="op-type">Payable type</Label>
            <Select
              id="op-type"
              value={draftType}
              onChange={(e) => setDraftType(e.target.value as "" | PayableType)}
              data-testid="payment-outstanding-filter-type"
            >
              <option value="">All payable types</option>
              <option value="PURCHASE_BILL">{payableTypeLabel("PURCHASE_BILL")}</option>
              <option value="LABOUR_PAYABLE">{payableTypeLabel("LABOUR_PAYABLE")}</option>
              <option value="SALARY">{payableTypeLabel("SALARY")}</option>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="md" onClick={apply} data-testid="payment-outstanding-apply">
              Apply
            </Button>
            <Button variant="ghost" size="md" onClick={clear} data-testid="payment-outstanding-clear">
              Clear filters
            </Button>
          </div>
        </div>
      </Card>

      {query.isLoading ? (
        <OutstandingSkeleton />
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
        <Card className="p-10" data-testid="payment-outstanding-empty">
          <EmptyState
            icon={CheckCircle2}
            iconTone="success"
            title="No open payables to show."
            description="All bills, labour payables, and salary payables for the selected filters are fully settled."
            action={
              partyId || payableType ? (
                <Button size="md" variant="outline" onClick={clear} data-testid="payment-outstanding-empty-clear">
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface" data-testid="payment-outstanding-list">
          <div className="overflow-x-auto">
            <div style={{ minWidth: 946 }}>
              <div
                role="row"
                className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 py-3"
                style={{ gridTemplateColumns: GRID }}
              >
                <Head>Payable ref</Head>
                <Head>Type</Head>
                <Head>Party</Head>
                <Head align="right"><Sort label="Original ৳" align="right" /></Head>
                <Head align="right"><Sort label="Applied ৳" align="right" /></Head>
                <Head align="right"><Sort label="Outstanding ৳" align="right" dir="desc" /></Head>
                <Head>Date</Head>
                <Head align="right" srLabel="Actions" />
              </div>
              {rows.map((r) => (
                <OpenPayableRow
                  key={`${r.payableType}:${r.payableId}`}
                  row={r}
                  partyName={partyName(r.partyId)}
                  expanded={
                    !!openRow && openRow.payableType === r.payableType && openRow.payableId === r.payableId
                  }
                  onToggle={() =>
                    setOpenRow(
                      openRow && openRow.payableType === r.payableType && openRow.payableId === r.payableId
                        ? null
                        : { payableType: r.payableType, payableId: r.payableId },
                    )
                  }
                />
              ))}
            </div>
          </div>
          <div
            className="flex items-center justify-between border-t border-border px-4 py-3 text-[12.5px] text-muted-foreground"
            data-testid="payment-outstanding-pagination"
          >
            <span>
              Showing <strong className="text-foreground">1–{rows.length}</strong> of{" "}
              <strong className="text-foreground">{rows.length}</strong> open payable{rows.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" disabled>Prev</Button>
              <span className="grid h-8 w-8 place-items-center rounded-token bg-primary text-[12.5px] font-semibold text-primary-foreground">
                1
              </span>
              <Button variant="outline" size="sm" disabled>Next</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OpenPayableRow({
  row,
  partyName,
  expanded,
  onToggle,
}: {
  row: OpenPayable;
  partyName: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <div
        className="grid items-center gap-2 border-b border-border px-4 py-3.5 text-[13px] text-foreground hover:bg-surface-2"
        role="row"
        data-testid={`payment-outstanding-row-${row.payableId}`}
        style={{ gridTemplateColumns: GRID }}
      >
        <span className="min-w-0 truncate font-mono font-semibold text-accent-ink" title={row.reference}>
          {row.reference}
        </span>
        <span>
          <PayableTypeBadge type={row.payableType} />
        </span>
        <span className="bn min-w-0 truncate text-[13px] text-foreground" title={partyName ?? row.reference}>
          {partyName ?? <span className="italic text-muted-foreground">{row.reference}</span>}
        </span>
        <span className="text-right">
          <span className={cn(MONEY, "text-foreground")}>{money(row.originalAmount)}</span>
        </span>
        <span className="text-right">
          <span className={cn(MONEY, "text-muted-foreground")}>{money(row.appliedAmount)}</span>
        </span>
        <span className="text-right" aria-label={`Outstanding ${row.remainingOutstanding} taka`}>
          <span className={cn(MONEY, "font-semibold text-foreground")}>{money(row.remainingOutstanding)}</span>
        </span>
        <span className="font-mono text-[12.5px] tabular-nums text-muted-foreground">{formatDate(row.payableDate)}</span>
        <span className="flex justify-end">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 rounded-token border border-border-strong bg-background px-2.5 py-1.5 text-[11.5px] font-semibold text-foreground hover:bg-surface-2"
            data-testid={`payment-outstanding-expand-${row.payableId}`}
          >
            View payments
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
          </button>
        </span>
      </div>
      {expanded && (
        <AppliedPaymentsDrillIn payableType={row.payableType} payableId={row.payableId} reference={row.reference} />
      )}
    </>
  );
}

function Head({
  children,
  align = "left",
  srLabel,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  srLabel?: string;
}) {
  return (
    <span
      className={cn(
        // `whitespace-nowrap` + `min-w-0` keep a long header inside its own grid track
        // instead of overlapping the next one when the table is at its minimum width.
        "min-w-0 whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground",
        align === "right" && "text-right",
      )}
    >
      {srLabel ? <span className="sr-only">{srLabel}</span> : children}
    </span>
  );
}

function Sort({ label, align = "left", dir }: { label: string; align?: "left" | "right"; dir?: "asc" | "desc" }) {
  return (
    <span className={cn("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}>
      {label}
      <span className="flex flex-col text-[8px] leading-[0.6]" aria-hidden>
        <span className={dir === "asc" ? "text-foreground" : "text-border-strong"}>▲</span>
        <span className={dir === "desc" ? "text-foreground" : "text-border-strong"}>▼</span>
      </span>
    </span>
  );
}

function OutstandingSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface" data-testid="payment-outstanding-loading">
      <div className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 py-3" style={{ gridTemplateColumns: GRID }}>
        {["Payable ref", "Type", "Party", "Original ৳", "Applied ৳", "Outstanding ৳", "Date", ""].map((h, i) => (
          <Head key={i} align={i >= 3 && i <= 5 ? "right" : "left"}>{h}</Head>
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="grid items-center gap-2 border-b border-border px-4 py-4" style={{ gridTemplateColumns: GRID }}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-24 rounded-pill" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-20 justify-self-end" />
          <Skeleton className="h-3 w-20 justify-self-end" />
          <Skeleton className="h-3 w-20 justify-self-end" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-28 justify-self-end rounded-token" />
        </div>
      ))}
    </div>
  );
}
