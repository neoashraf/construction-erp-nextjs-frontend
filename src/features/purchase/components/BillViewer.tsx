"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { useOnline } from "@/lib/hooks/use-online";
import { asApiError } from "@/lib/api";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canCancelBill } from "../access";
import { useBillMutations } from "../hooks/useBillMutations";
import { useBillLedgerEntry } from "../hooks/useBillViewer";
import { BillStatusBadge } from "./BillStatusBadge";
import { BillLedgerLinesTable } from "./BillLedgerLinesTable";
import { BillInventoryPanel } from "./BillInventoryPanel";
import { BillLinkagePanel } from "./BillLinkagePanel";
import { CancelBillDialog } from "./CancelBillDialog";
import { RepostDialog } from "./RepostDialog";
import { mapBillError, isCancellableBill, formToWriteInput } from "../schemas/bill.schema";
import { type PurchaseBill } from "../types";
import type { BillFormValues } from "../schemas/bill.schema";

/**
 * Purchase Bill viewer (brief §Scope 9-14; spec §4/§6; FR-PUR-020, FR-PUR-022, FR-PUR-023,
 * FR-PUR-024). Read-only representation of a POSTED / CANCELLED bill: header, balanced
 * ledger-lines table (from the LED entry), inventory-movements panel, per-bill
 * outstanding, linkage panel, action bar. Never re-derives the balanced Dr/Cr — displays
 * only what the backend wrote. Cancel + Repost are the ONLY further actions; both
 * `purchase:cancel`-gated with a mandatory reason confirm dialog. Editing a posted bill
 * is deliberately impossible (no field is ever editable for any role — FR-PUR-024).
 */
export function BillViewer({
  bill,
  repostFormBuilder,
}: {
  bill: PurchaseBill;
  /** Supplied by the page shell — builds the corrected form for a Repost. */
  repostFormBuilder?: () => BillFormValues | null;
}) {
  const router = useRouter();
  const online = useOnline();
  const { toast } = useToast();
  const user = useAuthenticatedUser();
  const canCancel = canCancelBill(user);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [repostOpen, setRepostOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const { cancel, repost } = useBillMutations();
  const entryQuery = useBillLedgerEntry(bill.journalEntryId);

  async function onCancelConfirm(reason: string) {
    if (!online) {
      setCancelOpen(false);
      setBanner("You're offline. Cancellation isn't available.");
      return;
    }
    setBusy(true);
    try {
      const res = await cancel.mutateAsync({ id: bill.id, reason, version: bill.version });
      setBusy(false);
      setCancelOpen(false);
      toast("Purchase bill cancelled.", "success");
      // Show the reversal number in the banner for orientation; page refetches header.
      setBanner(`Reversal entry ${res.reversalEntryNo} posted.`);
    } catch (err) {
      setBusy(false);
      setCancelOpen(false);
      const e = asApiError(err);
      setBanner(mapBillError(e.code).message);
    }
  }

  async function onRepostConfirm(reason: string) {
    if (!online) {
      setRepostOpen(false);
      setBanner("You're offline. Correction isn't available.");
      return;
    }
    const values = repostFormBuilder?.();
    if (!values) {
      setRepostOpen(false);
      setBanner("Please review the bill and try again.");
      return;
    }
    setBusy(true);
    try {
      const res = await repost.mutateAsync({
        id: bill.id,
        input: { ...formToWriteInput(values), reason, version: bill.version },
      });
      setBusy(false);
      setRepostOpen(false);
      toast(`Purchase bill corrected — new entry ${res.entryNo}.`, "success");
      router.replace(`/purchase/bills/${res.id}`);
    } catch (err) {
      setBusy(false);
      setRepostOpen(false);
      const e = asApiError(err);
      setBanner(mapBillError(e.code).message);
    }
  }

  const isCancelled = bill.status === "CANCELLED";
  const canWriteAction = canCancel && isCancellableBill(bill.status);

  return (
    <div className="mx-auto max-w-6xl pb-24 lg:pb-6" data-testid="bill-viewer">
      <Breadcrumb
        items={[
          { label: "Purchase" },
          { label: "Purchase bills", href: "/purchase/bills" },
          { label: bill.entryNo ?? "Bill" },
        ]}
      />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold tracking-[-0.02em]" data-testid="bill-viewer-title">
          {bill.entryNo ?? "Purchase bill"}
        </h1>
        <BillStatusBadge status={bill.status} />
        <div className="ml-auto flex gap-2">
          <Button
            variant="ghost"
            size="md"
            onClick={() => router.push("/purchase/bills")}
            data-testid="bill-viewer-back"
          >
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
            Back
          </Button>
          {canWriteAction && (
            <>
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setBanner(null);
                  setRepostOpen(true);
                }}
                disabled={busy}
                data-testid="bill-repost"
              >
                Repost (correct)
              </Button>
              <Button
                size="md"
                variant="outline"
                onClick={() => {
                  setBanner(null);
                  setCancelOpen(true);
                }}
                disabled={busy}
                data-testid="bill-cancel"
              >
                Cancel bill
              </Button>
            </>
          )}
        </div>
      </div>

      {banner && (
        <Alert
          tone={isCancelled || banner.startsWith("Reversal entry") ? "info" : "destructive"}
          title={banner}
          className="mb-4"
          data-testid="bill-viewer-banner"
        />
      )}

      {isCancelled && (
        <Alert
          tone="warning"
          title={`This bill was cancelled. Its original number ${bill.entryNo ?? "—"} is retained on the reversed entry.`}
          className="mb-4"
          data-testid="bill-cancelled-ribbon"
        />
      )}

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Supplier">{bill.supplierId}</Field>
          <Field label="Project">{bill.projectId}</Field>
          <Field label="Bill date">{formatDate(bill.billDate)}</Field>
          <Field label="Due date">{formatDate(bill.dueDate)}</Field>
          {bill.supplierInvoiceRef && <Field label="Supplier invoice">{bill.supplierInvoiceRef}</Field>}
          {bill.purchaseOrderId && <Field label="From PO">{bill.purchaseOrderId}</Field>}
          {bill.postedAt && <Field label="Posted at">{new Date(bill.postedAt).toLocaleString()}</Field>}
          {bill.postedBy && <Field label="Posted by">{bill.postedBy}</Field>}
        </div>
        {bill.narration && (
          <div className="mt-4 border-t border-muted pt-3">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">Narration</div>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground [overflow-wrap:anywhere]">
              {bill.narration}
            </p>
          </div>
        )}
      </Card>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Total label="Gross" value={bill.grossAmount} />
        <Total label="Net payable" value={bill.netPayableAmount} emphasise />
        <Total label="Outstanding" value={bill.outstandingAmount} />
      </div>

      <Card className="mt-4 flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
            Balanced ledger lines
          </h2>
          {bill.journalEntryId && (
            <Link
              href={`/ledger/entry-viewer?id=${bill.journalEntryId}`}
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent-ink hover:underline"
              data-testid="bill-view-ledger"
            >
              View ledger entry
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </div>

        {entryQuery.isLoading ? (
          <p className="text-[12.5px] text-faint">Loading ledger lines…</p>
        ) : entryQuery.isError ? (
          <Alert
            tone="destructive"
            title={
              asApiError(entryQuery.error).code === "FORBIDDEN"
                ? "You don't have access to the ledger entry for this bill."
                : "Couldn't load the ledger lines for this bill."
            }
            data-testid="bill-ledger-error"
          >
            <Button size="sm" onClick={() => entryQuery.refetch()}>
              Retry
            </Button>
          </Alert>
        ) : entryQuery.data ? (
          <BillLedgerLinesTable lines={entryQuery.data.lines} />
        ) : (
          <p className="text-[12.5px] text-faint">This bill has no posted ledger entry yet.</p>
        )}
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <BillInventoryPanel lines={bill.lines} />
        <BillLinkagePanel entry={entryQuery.data ?? null} billEntryNo={bill.entryNo} />
      </div>

      <CancelBillDialog
        open={cancelOpen}
        busy={busy}
        entryNo={bill.entryNo}
        onOpenChange={(o) => !o && setCancelOpen(false)}
        onConfirm={onCancelConfirm}
      />
      <RepostDialog
        open={repostOpen}
        busy={busy}
        entryNo={bill.entryNo}
        onOpenChange={(o) => !o && setRepostOpen(false)}
        onConfirm={onRepostConfirm}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">{label}</div>
      <div className="mt-0.5 text-[13px] text-foreground [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

function Total({
  label,
  value,
  emphasise,
}: {
  label: string;
  value: string;
  emphasise?: boolean;
}) {
  return (
    <div className="rounded-card border border-border bg-surface-2 px-4 py-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">{label}</div>
      <div
        className={
          emphasise
            ? "mt-0.5 font-mono text-[16px] font-bold tabular-nums text-foreground"
            : "mt-0.5 font-mono text-[13px] font-semibold tabular-nums text-foreground"
        }
      >
        {formatMoney(value)}
      </div>
    </div>
  );
}
