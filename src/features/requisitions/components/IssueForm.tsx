"use client";

import { useMemo } from "react";
import { ArrowRight, Home } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatMoney, formatQty, toDecimal } from "@/lib/money";
import { OnHandBadge } from "./OnHandBadge";
import { NegativeStockOverride } from "./NegativeStockOverride";
import { IssueLineCard, QtyStepper, type IssueLineState } from "./IssueLineCard";
import { IssueResultSummary } from "./IssueResultSummary";
import { isIssuable } from "../schemas/requisition-issue.schema";
import { type OnHandResult } from "../hooks/useRequisitionIssues";
import { type GodownOption, type ItemOption, type RequisitionIssue } from "../types";

const DESKTOP_GRID = "minmax(170px,1.6fr) 88px minmax(150px,1fr) 132px 168px 128px";
const NUM = "whitespace-nowrap font-mono text-[13px] tabular-nums";

export interface IssueNegState {
  enabled: boolean;
  reason: string;
  error: string | null;
}

/**
 * (A) Issue-material form (spec §4/§5A; FR-REQ-012…-016). One atomic issue across every line
 * with a positive quantity: per line a source-godown override, an on-hand badge, a bounded
 * quantity stepper + "Issue all", and — when the quantity exceeds on-hand — the negative-stock
 * warning/override. Desktop is a grid; ≥360 mobile is stacked line cards with a sticky bottom
 * Issue bar (owned by the detail). Rate/value are server-computed; the line total is "estimated".
 */
export function IssueForm({
  headerGodownId,
  onHeaderGodownChange,
  godowns,
  items,
  lines,
  onLineChange,
  onHand,
  canOverride,
  neg,
  onNegToggle,
  onNegReasonChange,
  onIssue,
  busy,
  result,
  lineItems,
}: {
  headerGodownId: string;
  onHeaderGodownChange: (id: string) => void;
  godowns: GodownOption[];
  items: Map<string, ItemOption>;
  lines: IssueLineState[];
  onLineChange: (lineId: string, patch: Partial<IssueLineState>) => void;
  onHand: OnHandResult[];
  canOverride: boolean;
  neg: IssueNegState;
  onNegToggle: (on: boolean) => void;
  onNegReasonChange: (v: string) => void;
  onIssue: () => void;
  busy: boolean;
  result: RequisitionIssue | null;
  lineItems: Map<string, ItemOption>;
}) {
  const godownName = useMemo(() => {
    const m = new Map(godowns.map((g) => [g.id, g.name]));
    return (id: string) => m.get(id) ?? "this godown";
  }, [godowns]);
  const itemName = (l: IssueLineState) => items.get(l.itemId)?.name ?? l.itemId.slice(0, 8);

  const meta = lines.map((l, i) => {
    const oh = onHand[i] ?? { onHand: null, isLoading: false };
    const issuing = isIssuable(l.quantity);
    const insufficient =
      issuing && !!oh.onHand && toDecimal(l.quantity).gt(toDecimal(oh.onHand.quantityOnHand));
    const rate = oh.onHand?.weightedAverageRate ?? null;
    const indicative =
      issuing && rate != null ? toDecimal(l.quantity).times(toDecimal(rate)).toFixed(4) : null;
    return { oh, issuing, insufficient, indicative };
  });

  const readyCount = meta.filter((m) => m.issuing).length;

  function negSlot(insufficient: boolean, l: IssueLineState) {
    if (!insufficient) return null;
    return (
      <NegativeStockOverride
        itemName={itemName(l)}
        godownName={godownName(l.godownId)}
        canOverride={canOverride}
        enabled={neg.enabled}
        reason={neg.reason}
        error={neg.error}
        onToggle={onNegToggle}
        onReasonChange={onNegReasonChange}
      />
    );
  }

  return (
    <Card className="overflow-hidden" data-testid="req-issue-form">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <span
          className="grid h-6 w-6 flex-none place-items-center rounded-token bg-primary text-[11px] font-bold text-primary-foreground"
          aria-hidden
        >
          A
        </span>
        <h2 className="text-sm font-bold text-foreground">Issue material</h2>
        <span className="text-[12.5px] text-muted-foreground">
          Stock moves and the consumption posts on confirm — one atomic step, no draft.
        </span>
      </div>

      {/* Header source godown */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface-2 px-4 py-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          Issue from
        </span>
        <div className="relative w-full max-w-xs">
          <Home
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Select
            value={headerGodownId}
            onChange={(e) => onHeaderGodownChange(e.target.value)}
            className="pl-9"
            aria-label="Issue-from source godown"
            data-testid="req-header-godown"
          >
            <option value="" disabled>
              Select a source godown
            </option>
            {godowns.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </div>
        <span className="text-[12px] text-muted-foreground">
          Default source for all lines · override per line below · must belong to the project.
        </span>
      </div>

      {/* Desktop grid */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 900 }}>
          <div
            role="row"
            className="grid items-center gap-3 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: DESKTOP_GRID }}
          >
            <div className="py-3">Item</div>
            <div className="py-3 text-right">Balance</div>
            <div className="py-3">Source godown</div>
            <div className="py-3">On hand</div>
            <div className="py-3">Issue qty</div>
            <div className="py-3 text-right">Line total ৳</div>
          </div>
          {lines.map((l, i) => {
            const m = meta[i]!;
            return (
              <div key={l.requisitionLineId} className="border-b border-muted">
                <div
                  className="grid items-center gap-3 px-4"
                  style={{ gridTemplateColumns: DESKTOP_GRID }}
                >
                  <div className="min-w-0 py-3">
                    <div className="text-[13px] font-medium text-foreground [overflow-wrap:anywhere]">
                      {itemName(l)}
                    </div>
                    <div className="text-[11.5px] text-faint">
                      Requested {formatQty(l.balance, 4)} {l.uom}
                    </div>
                  </div>
                  <div className={cn("py-3 text-right font-semibold text-warning-ink", NUM)}>
                    {formatQty(l.balance, 4)}{" "}
                    <span className="text-[10px] text-faint">{l.uom}</span>
                  </div>
                  <div className="py-3">
                    <Select
                      value={l.godownId}
                      onChange={(e) =>
                        onLineChange(l.requisitionLineId, { godownId: e.target.value })
                      }
                      aria-label={`Source godown for ${itemName(l)}`}
                      data-testid="req-line-godown"
                    >
                      {godowns.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="py-3">
                    <OnHandBadge
                      onHand={m.oh.onHand}
                      uom={l.uom}
                      loading={m.oh.isLoading}
                      insufficient={m.insufficient}
                    />
                  </div>
                  <div className="py-3">
                    <QtyStepper
                      value={l.quantity}
                      balance={l.balance}
                      disabled={m.oh.isLoading}
                      invalid={!!l.error}
                      onChange={(v) => onLineChange(l.requisitionLineId, { quantity: v })}
                      testid="req-line-qty"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onLineChange(l.requisitionLineId, {
                          quantity: toDecimal(l.balance).toFixed(4),
                        })
                      }
                      disabled={m.oh.isLoading}
                      className="mt-1 block text-[12px] font-semibold text-accent-ink hover:underline disabled:opacity-50"
                      data-testid="req-issue-all"
                    >
                      Issue all ({formatQty(l.balance, 4)})
                    </button>
                  </div>
                  <div className="py-3 text-right">
                    {m.indicative != null ? (
                      <>
                        <div className={cn("font-semibold text-foreground", NUM)}>
                          {formatMoney(m.indicative)}
                        </div>
                        <div className="text-[11px] italic text-faint">estimated</div>
                      </>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </div>
                </div>
                {m.insufficient && <div className="px-4 pb-3">{negSlot(true, l)}</div>}
                {l.error && (
                  <div className="px-4 pb-3">
                    <p
                      role="alert"
                      className="text-[12px] font-medium text-destructive-ink"
                      data-testid="req-line-error"
                    >
                      {l.error}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 p-4 lg:hidden">
        {lines.map((l, i) => {
          const m = meta[i]!;
          return (
            <IssueLineCard
              key={l.requisitionLineId}
              line={l}
              itemName={itemName(l)}
              onHand={m.oh.onHand}
              onHandLoading={m.oh.isLoading}
              insufficient={m.insufficient}
              godowns={godowns}
              onChange={(patch) => onLineChange(l.requisitionLineId, patch)}
              negativeSlot={negSlot(m.insufficient, l)}
            />
          );
        })}
      </div>

      {result && (
        <div className="px-4 pb-4">
          <IssueResultSummary result={result} lineItems={lineItems} />
        </div>
      )}

      {/* Desktop footer (mobile uses the detail's sticky bar) */}
      <div className="hidden flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 lg:flex">
        <p className="max-w-xl text-[12.5px] text-muted-foreground">
          Confirms every line with a quantity in one atomic step — stock deducts and the consumption
          posts together. Notifies the requester by SMS.
        </p>
        <div className="flex flex-none items-center gap-3">
          <span className="text-[12.5px] font-semibold text-muted-foreground" aria-live="polite">
            {readyCount} line{readyCount === 1 ? "" : "s"} ready
          </span>
          <Button
            size="md"
            onClick={onIssue}
            disabled={busy || readyCount === 0}
            aria-busy={busy || undefined}
            className="gap-1.5"
            data-testid="req-issue"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
            {busy ? "Posting consumption…" : "Issue"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
