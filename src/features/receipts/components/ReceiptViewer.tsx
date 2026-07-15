"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ExternalLink, Lock, Printer, Repeat, Search, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";
import { asApiError } from "@/lib/api/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { useOnline } from "@/lib/hooks/use-online";
import { useMasterLookups } from "@/lib/masters/lookups";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canCancelReceipt } from "../access";
import { useReceiptViewer } from "../hooks/useReceiptViewer";
import { useReceiptCorrections } from "../hooks/useReceiptCorrections";
import { useIpcOutstanding } from "../hooks/useIpcOutstanding";
import { mapReceiptError } from "../schemas/receipt.schema";
import { PaymentModeTag, paymentModeLabel } from "./PaymentModeTag";
import { ReceiptLedgerLinesTable } from "./ReceiptLedgerLinesTable";
import { ReceiptLinkagePanel } from "./ReceiptLinkagePanel";
import { ReceiptIpcBalancePanel } from "./ReceiptIpcBalancePanel";
import { CancelReceiptDialog } from "./CancelReceiptDialog";
import { RepostReceiptDialog } from "./RepostReceiptDialog";
import { MoneyReceiptPrintPreview } from "./MoneyReceiptPrintPreview";

/**
 * Receipt viewer — read-only detail for one POSTED/CANCELLED receipt (spec §4/§6;
 * FR-REC-013/-015/-016/-018/-021/-022/-023/-024/-025; brief §5). A DRAFT id redirects
 * to the editor; a missing id renders the 404 state. Carries Cancel + Repost (both
 * `receipt:cancel`) as its two mutating actions — never an in-place edit of a posted
 * receipt (FR-REC-024). Ledger-lines panel (`ledger.journal_entries:READ` — brief G2)
 * degrades separately from the receipt header so a PM's 403 on lines doesn't blank
 * the header.
 */
export function ReceiptViewer({ receiptId }: { receiptId: string }) {
  const router = useRouter();
  const online = useOnline();
  const { toast } = useToast();
  const user = useAuthenticatedUser();
  const canCancel = canCancelReceipt(user);
  const lookups = useMasterLookups();

  const { receipt: rcpQ, entry: entryQ } = useReceiptViewer(receiptId);
  const receipt = rcpQ.data;

  const outstandingQ = useIpcOutstanding(receipt?.ipcId ?? null);
  const { cancel, repost } = useReceiptCorrections();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [repostOpen, setRepostOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const err = rcpQ.isError ? asApiError(rcpQ.error) : null;
  const notFound = err?.code === "NOT_FOUND" || err?.status === 404;
  const forbidden = err?.code === "FORBIDDEN" || err?.status === 403;
  const otherError = rcpQ.isError && !notFound && !forbidden;

  const entryErr = entryQ.isError ? asApiError(entryQ.error) : null;
  const linesErrCode: "FORBIDDEN" | "OTHER" | null = entryErr
    ? entryErr.code === "FORBIDDEN" || entryErr.status === 403
      ? "FORBIDDEN"
      : "OTHER"
    : null;

  // DRAFT id → send to the editor (viewer is only for POSTED/CANCELLED, FR-REC-024).
  const draftId = receipt?.status === "DRAFT" ? receipt.id : null;
  useMemo(() => {
    if (draftId) router.replace(`/receipts/${draftId}`);
  }, [draftId, router]);

  const goBack = () => router.push("/receipts");

  if (rcpQ.isLoading) return <LoadingShell />;

  if (notFound) {
    return (
      <ViewerShell>
        <Card className="mt-6 p-10" data-testid="receipt-not-found">
          <EmptyState
            icon={Search}
            title="Receipt not found"
            description="This receipt doesn't exist or isn't in your company."
            action={
              <Button size="md" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
            }
          />
        </Card>
      </ViewerShell>
    );
  }

  if (forbidden) {
    return (
      <ViewerShell>
        <Card className="mt-6 p-10" data-testid="receipt-forbidden">
          <EmptyState
            icon={Lock}
            title="You don't have access to this receipt."
            description="If you're a project manager, you can only view receipts on your assigned projects."
            action={
              <Button size="md" variant="outline" onClick={goBack}>
                Back
              </Button>
            }
          />
        </Card>
      </ViewerShell>
    );
  }

  if (otherError) {
    return (
      <ViewerShell>
        <Card className="mt-6 p-10" data-testid="receipt-viewer-error">
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load this receipt. Please try again."
            description="Check your connection and retry."
            action={
              <Button size="md" onClick={() => rcpQ.refetch()} data-testid="receipt-viewer-retry">
                Retry
              </Button>
            }
          />
        </Card>
      </ViewerShell>
    );
  }

  if (!receipt || receipt.status === "DRAFT") return null;

  const isIpc = receipt.receiptType === "IPC_LINKED";
  const isCancelled = receipt.status === "CANCELLED";
  const partyName =
    lookups.party(receipt.partyId) || `${receipt.partyId.slice(0, 8)} (name unavailable)`;
  const depositName = receipt.depositAccountId
    ? lookups.accountName(receipt.depositAccountId) ??
      `${receipt.depositAccountId.slice(0, 8)} (name unavailable)`
    : null;
  const projectName = receipt.projectId
    ? lookups.project(receipt.projectId) || receipt.projectId
    : null;

  async function onCancelConfirm(reason: string) {
    if (!receipt) return;
    setBusy(true);
    setBanner(null);
    try {
      const result = await cancel.mutateAsync({ id: receipt.id, reason, version: receipt.version });
      setCancelOpen(false);
      toast(`Receipt cancelled — ${result.reversalEntryNo} recorded.`, "success");
    } catch (err) {
      setCancelOpen(false);
      const mapped = mapReceiptError(asApiError(err).code);
      const stale =
        asApiError(err).code === "ALREADY_REVERSED" ||
        asApiError(err).code === "VOUCHER_NOT_POSTED";
      setBanner(stale ? "This receipt has already been cancelled." : mapped.message);
      if (stale) rcpQ.refetch();
    } finally {
      setBusy(false);
    }
  }

  async function onRepostConfirm(input: { amountSettled: string; taxDeductedAtSource: string; reason: string }) {
    if (!receipt) return;
    setBusy(true);
    setBanner(null);
    try {
      const body =
        receipt.receiptType === "IPC_LINKED"
          ? {
              receiptType: "IPC_LINKED" as const,
              receiptDate: receipt.receiptDate,
              paymentMode: receipt.paymentMode,
              depositAccountId: receipt.depositAccountId,
              ipcId: receipt.ipcId!,
              amountSettled: input.amountSettled,
              taxDeductedAtSource: input.taxDeductedAtSource,
              chequeTxnRef: receipt.chequeTxnRef,
              narration: receipt.narration,
            }
          : {
              receiptType: "GENERAL" as const,
              receiptDate: receipt.receiptDate,
              paymentMode: receipt.paymentMode,
              depositAccountId: receipt.depositAccountId,
              partyId: receipt.partyId,
              generalTargetAccountId: receipt.generalTargetAccountId!,
              projectId: receipt.projectId,
              costCentreId: receipt.costCentreId!,
              purposeId: receipt.purposeId,
              amountSettled: input.amountSettled,
              chequeTxnRef: receipt.chequeTxnRef,
              narration: receipt.narration,
            };
      const result = await repost.mutateAsync({
        id: receipt.id,
        input: { ...body, reason: input.reason, version: receipt.version },
      });
      setRepostOpen(false);
      toast(`Receipt corrected — new number ${result.entryNo}.`, "success");
      // Navigate to the new viewer instance so the corrected entry becomes the surface.
      rcpQ.refetch();
    } catch (err) {
      setRepostOpen(false);
      setBanner(mapReceiptError(asApiError(err).code, { outstanding: outstandingQ.data?.balanceDue ?? null }).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl pb-6" data-testid="receipt-viewer">
      <Breadcrumb items={[{ label: "Receipts", href: "/receipts" }, { label: receipt.entryNo ?? "Receipt" }]} />
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-[23px] font-bold tracking-[-0.01em] text-foreground" data-testid="receipt-viewer-title">
          Receipt {receipt.entryNo ?? ""}
        </h1>
        <Badge tone={isCancelled ? "neutral" : "success"} dot data-testid={`receipt-viewer-status-${receipt.status}`}>
          {isCancelled ? "Cancelled" : "Posted"}
        </Badge>
        <Badge tone={isIpc ? "info" : "accent"} data-testid={`receipt-viewer-type-${receipt.receiptType}`}>
          {isIpc ? "IPC-linked" : "General"}
        </Badge>
      </div>

      {!online && (
        <Alert tone="warning" title="You're offline." className="mt-3" data-testid="receipt-viewer-offline">
          Showing the last loaded receipt. Print, Cancel and Repost are disabled until you reconnect.
        </Alert>
      )}

      {banner && <Alert tone="destructive" title={banner} className="mt-3" data-testid="receipt-viewer-banner" />}

      {isCancelled && (
        <div
          className="mt-3 flex flex-wrap items-center gap-3 rounded-card border border-border-strong bg-muted p-3.5"
          data-testid="receipt-cancelled-ribbon"
        >
          <span className="inline-flex h-6 items-center gap-1.5 rounded-pill bg-border-strong px-2.5 text-[11px] font-bold uppercase tracking-[0.3px] text-muted-foreground">
            Superseded
          </span>
          <span className="text-[12.5px] text-muted-foreground">
            This receipt was cancelled. The ledger lines below are the original posting, retained for audit.
          </span>
        </div>
      )}

      <div
        className="mt-3 flex items-start gap-3 rounded-card border border-accent-soft bg-accent-soft/40 p-3"
        data-testid="receipt-immutability-note"
      >
        <Lock className="mt-0.5 h-4 w-4 flex-none text-accent-ink" aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Posted receipts can&rsquo;t be edited. To correct this, cancel or repost it below.
        </p>
      </div>

      {/* Header block */}
      <Card className="mt-4 p-5" data-testid="receipt-header-block">
        <div className="flex flex-wrap items-start gap-6">
          <HeaderField label="Party" value={partyName} minWidth={200} bn />
          <HeaderField
            label="Payment"
            value={`${paymentModeLabel(receipt.paymentMode)}${receipt.chequeTxnRef ? ` · ${receipt.chequeTxnRef}` : ""}`}
          />
          <HeaderField label="Deposit account" value={depositName ?? "—"} />
          <HeaderField label="Receipt date" value={formatDate(receipt.receiptDate)} mono />
          {projectName && <HeaderField label="Project" value={projectName} />}
          <div className="ml-auto flex flex-col items-end gap-0.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Posted</span>
            <span className="font-mono text-[13px] tabular-nums text-foreground" data-testid="receipt-posted-at">
              {receipt.postedAt ? formatDateTime(receipt.postedAt) : "—"}
            </span>
            <span className="bn text-[12px] text-muted-foreground">
              by {receipt.postedBy ? lookups.party(receipt.postedBy) || receipt.postedBy : "—"}
            </span>
          </div>
        </div>
      </Card>

      {/* Money summary + IPC panel (or general-target summary) */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5" data-testid="receipt-money-summary">
          <h2 className="text-[13px] font-bold text-foreground">Money summary</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
            <dt className="text-muted-foreground">Amount settled</dt>
            <dd className="text-right font-mono tabular-nums text-foreground">{formatMoney(receipt.amountSettled)}</dd>
            <dt className="text-muted-foreground">Tax deducted at source</dt>
            <dd className="text-right font-mono tabular-nums text-foreground">{formatMoney(receipt.taxDeductedAtSource)}</dd>
            <dt className="font-semibold text-foreground">Cash received</dt>
            <dd className="text-right font-mono font-bold tabular-nums text-foreground">
              {formatMoney(receipt.cashReceived)}
            </dd>
          </dl>
          {receipt.narration && (
            <div className="mt-4">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                Narration
              </div>
              <p className="bn mt-1 text-[13px] text-foreground [overflow-wrap:anywhere]">{receipt.narration}</p>
            </div>
          )}
        </Card>

        {isIpc && receipt.ipcId ? (
          <ReceiptIpcBalancePanel
            ipcId={receipt.ipcId}
            ipcLabel={receipt.ipcId}
            ipcCurrentlyDue={outstandingQ.data?.ipcCurrentlyDue ?? null}
            ipcOutstandingAfter={
              isCancelled
                ? outstandingQ.data?.balanceDue ?? null
                : receipt.ipcOutstandingAfter ?? outstandingQ.data?.balanceDue ?? null
            }
            onRefresh={() => outstandingQ.refetch()}
            isRefreshing={outstandingQ.isFetching}
          />
        ) : (
          <Card className="p-4" data-testid="receipt-general-target-summary">
            <h2 className="text-[13px] font-bold text-foreground">Credited to</h2>
            <p className="mt-3 text-[13px] text-foreground">
              {receipt.generalTargetAccountId
                ? lookups.accountLabel(receipt.generalTargetAccountId)
                : "—"}
            </p>
            <p className="mt-2 text-[11.5px] text-muted-foreground">
              {receipt.projectId ? `Project · ${projectName}` : "Tagged: General (no project)"}
            </p>
          </Card>
        )}
      </div>

      {/* Ledger-lines panel */}
      <ReceiptLedgerLinesTable
        entry={entryQ.data}
        isLoading={entryQ.isLoading}
        errorCode={linesErrCode}
        ledgerHref={receipt.journalEntryId ? `/ledger/entry-viewer?id=${receipt.journalEntryId}` : null}
        onRetry={() => entryQ.refetch()}
      />

      {/* Linkage panel */}
      <ReceiptLinkagePanel
        linkage={receipt.linkage}
        hrefForEntry={(entryId) => `/ledger/entry-viewer?id=${entryId}`}
      />

      {/* Action bar */}
      <div className="mt-6 flex flex-wrap items-center gap-2.5" data-testid="receipt-viewer-actions">
        <Button variant="outline" onClick={goBack} data-testid="receipt-viewer-back">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Button>
        {receipt.journalEntryId && (
          <Button variant="outline" asChild disabled={!online}>
            <Link href={`/ledger/entry-viewer?id=${receipt.journalEntryId}`} data-testid="receipt-viewer-view-in-ledger">
              <ExternalLink className="h-4 w-4" aria-hidden />
              View ledger entry
            </Link>
          </Button>
        )}
        {isIpc && receipt.ipcId && (
          <Button variant="outline" asChild>
            <Link href={`/sales/ipcs/${receipt.ipcId}`} data-testid="receipt-viewer-view-ipc">
              <ExternalLink className="h-4 w-4" aria-hidden />
              View IPC
            </Link>
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => setPrintOpen(true)}
          disabled={!online}
          data-testid="receipt-viewer-print"
        >
          <Printer className="h-4 w-4" aria-hidden />
          Print
        </Button>
        {!isCancelled && canCancel && (
          <>
            <span className="mx-1 h-6 w-px bg-border-strong" aria-hidden />
            <Button
              variant="outline"
              onClick={() => setRepostOpen(true)}
              disabled={busy || !online}
              data-testid="receipt-viewer-repost"
            >
              <Repeat className="h-4 w-4" aria-hidden />
              Repost / Correct
            </Button>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive-ink hover:bg-destructive-soft"
              onClick={() => setCancelOpen(true)}
              disabled={busy || !online}
              data-testid="receipt-viewer-cancel"
            >
              <XCircle className="h-4 w-4" aria-hidden />
              Cancel receipt
            </Button>
          </>
        )}
      </div>

      <CancelReceiptDialog
        open={cancelOpen}
        busy={busy}
        onConfirm={onCancelConfirm}
        onCancel={() => setCancelOpen(false)}
      />
      <RepostReceiptDialog
        open={repostOpen}
        busy={busy}
        receipt={receipt}
        onConfirm={onRepostConfirm}
        onCancel={() => setRepostOpen(false)}
      />
      <MoneyReceiptPrintPreview
        open={printOpen}
        receipt={receipt}
        companyName={null}
        companyAddress={null}
        companyTin={null}
        companyBin={null}
        partyName={partyName}
        depositAccountName={depositName}
        ipcLabel={isIpc && receipt.ipcId ? receipt.ipcId : null}
        onClose={() => setPrintOpen(false)}
      />
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Receipts", href: "/receipts" }, { label: "Receipt" }]} />
      <div className="mb-3 mt-1 flex items-center gap-3">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-6 w-20 rounded-pill" />
      </div>
      <Card className="mt-3 flex flex-wrap gap-6 p-5" data-testid="receipt-viewer-loading">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        ))}
      </Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="mb-2 h-4 w-full" />)}
        </Card>
        <Card className="p-4">
          <Skeleton className="h-24 w-full" />
        </Card>
      </div>
    </div>
  );
}

function ViewerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Receipts", href: "/receipts" }, { label: "Receipt" }]} />
      {children}
    </div>
  );
}

function HeaderField({
  label,
  value,
  minWidth,
  mono,
  bn,
}: {
  label: string;
  value: string;
  minWidth?: number;
  mono?: boolean;
  bn?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1" style={{ minWidth: minWidth ? `${minWidth}px` : undefined }}>
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">{label}</span>
      <span
        className={
          "text-[14px] leading-snug text-foreground [overflow-wrap:anywhere] " +
          (mono ? "font-mono tabular-nums " : "") +
          (bn ? "bn " : "")
        }
      >
        {value || "—"}
      </span>
    </div>
  );
}

// Re-export the mode tag so the print preview can import it via this barrel.
export { PaymentModeTag };
