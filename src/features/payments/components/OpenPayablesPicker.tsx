"use client";

import { Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { PayableTypeBadge } from "./PayableTypeBadge";
import { useOpenPayables } from "../hooks/useOpenPayables";
import { type OpenPayable } from "../types";

/**
 * Open-payables picker dialog (spec §5/§9). Lists the payee's posted, unsettled
 * payables from `GET /api/payment/open-payables?partyId=…`; clicking a row adds it as
 * an allocation. Already-picked payables are omitted (single allocation per payable).
 */
export function OpenPayablesPicker({
  open,
  partyId,
  excludeIds,
  onPick,
  onClose,
}: {
  open: boolean;
  partyId: string;
  excludeIds: string[];
  onPick: (row: OpenPayable) => void;
  onClose: () => void;
}) {
  const query = useOpenPayables({ partyId: partyId || undefined });
  const rows = (query.data ?? []).filter((r) => !excludeIds.includes(`${r.payableType}:${r.payableId}`));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[720px] p-0" hideClose data-testid="open-payables-picker">
        <div className="border-b border-border bg-surface-2 px-5 py-4">
          <DialogTitle className="text-[14px] font-bold text-foreground">Add a payable</DialogTitle>
          <DialogDescription className="mt-1 text-[12px] text-muted-foreground">
            Posted, unsettled payables of this payee — supplier bills, daily-labour, salary.
          </DialogDescription>
        </div>
        <div className="max-h-[60vh] overflow-auto p-4">
          {!partyId ? (
            <Card className="p-8">
              <EmptyState
                icon={Inbox}
                title="Choose a payee first."
                description="Open payables are scoped to the selected payee."
              />
            </Card>
          ) : query.isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <Card className="p-8" data-testid="open-payables-empty">
              <EmptyState
                icon={Inbox}
                title="No open payables for this payee."
                description="Every posted payable of this payee has been fully settled."
              />
            </Card>
          ) : (
            <div className="grid grid-cols-[1.6fr_0.6fr_0.9fr_1fr_1fr_1fr_auto] gap-2 text-[12.5px]">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Reference</span>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Type</span>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Date</span>
              <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Original</span>
              <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Applied</span>
              <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Outstanding</span>
              <span />
              {rows.map((r) => (
                <div key={`${r.payableType}:${r.payableId}`} className="col-span-7 grid grid-cols-[1.6fr_0.6fr_0.9fr_1fr_1fr_1fr_auto] items-center gap-2 border-t border-border py-2">
                  <span className="font-mono font-semibold text-accent-ink [overflow-wrap:anywhere]">{r.reference}</span>
                  <span><PayableTypeBadge type={r.payableType} /></span>
                  <span className="font-mono text-muted-foreground">{formatDate(r.payableDate)}</span>
                  <span className="text-right font-mono tabular-nums text-foreground">{formatMoney(r.originalAmount)}</span>
                  <span className="text-right font-mono tabular-nums text-muted-foreground">{formatMoney(r.appliedAmount)}</span>
                  <span className="text-right font-mono font-semibold tabular-nums text-foreground">{formatMoney(r.remainingOutstanding)}</span>
                  <Button
                    size="sm"
                    onClick={() => onPick(r)}
                    data-testid={`open-payables-pick-${r.payableId}`}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2.5 border-t border-border px-5 py-3">
          <Button variant="outline" size="md" onClick={onClose} data-testid="open-payables-close">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
