"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ExternalLink, Lock, Repeat, Search, XCircle } from "lucide-react";
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
import { canCancelPayment } from "../access";
import { usePaymentViewer } from "../hooks/usePaymentViewer";
import { usePaymentEditorMutations } from "../hooks/usePaymentEditorMutations";
import { mapPaymentError } from "../schemas/payment.schema";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { PaymentModeBadge, paymentModeLabel } from "./PaymentModeBadge";
import { PaymentLedgerLinesTable } from "./PaymentLedgerLinesTable";
import { PaymentAllocationsPanel } from "./PaymentAllocationsPanel";
import { PaymentLinkagePanel } from "./PaymentLinkagePanel";
import { CancelPaymentDialog } from "./CancelPaymentDialog";

/**
 * Payment viewer — read-only detail for one POSTED/CANCELLED payment (spec §4/§6;
 * FR-PAY-010/-011/-013/-015/-016/-017/-018/-019). A DRAFT id redirects to the editor;
 * a missing id renders the 404 state. Carries Cancel + Correct (both
 * `payment:cancel`-gated) as its only mutating actions — never an in-place edit of a
 * posted payment (FR-PAY-018). Ledger-lines panel (`ledger.journal_entries:READ`)
 * degrades separately so a missing LED grant doesn't blank the header.
 */
export function PaymentViewer({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const online = useOnline();
  const { toast } = useToast();
  const user = useAuthenticatedUser();
  const canCancel = canCancelPayment(user);
  const lookups = useMasterLookups();

  const { payment: payQ, entry: entryQ } = usePaymentViewer(paymentId);
  const payment = payQ.data;

  const { cancel } = usePaymentEditorMutations();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const err = payQ.isError ? asApiError(payQ.error) : null;
  const notFound = err?.code === "NOT_FOUND" || err?.status === 404;
  const forbidden = err?.code === "FORBIDDEN" || err?.status === 403;
  const otherError = payQ.isError && !notFound && !forbidden;

  const entryErr = entryQ.isError ? asApiError(entryQ.error) : null;
  const linesErrCode: "FORBIDDEN" | "OTHER" | null = entryErr
    ? entryErr.code === "FORBIDDEN" || entryErr.status === 403
      ? "FORBIDDEN"
      : "OTHER"
    : null;

  // DRAFT id → send to the editor (viewer is only for POSTED/CANCELLED, FR-PAY-018).
  const draftId = payment?.status === "DRAFT" ? payment.id : null;
  useMemo(() => {
    if (draftId) router.replace(`/payments/${draftId}`);
  }, [draftId, router]);

  const goBack = () => router.push("/payments");

  if (payQ.isLoading) return <LoadingShell />;
  if (notFound) {
    return (
      <ViewerShell>
        <Card className="mt-6 p-10" data-testid="payment-viewer-not-found">
          <EmptyState
            icon={Search}
            title="Payment not found"
            description="This payment doesn't exist or isn't in your company."
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
        <Card className="mt-6 p-10" data-testid="payment-viewer-forbidden">
          <EmptyState
            icon={Lock}
            title="You don't have access to this payment."
            action={
              <Button size="md" variant="outline" onClick={goBack}>Back</Button>
            }
          />
        </Card>
      </ViewerShell>
    );
  }
  if (otherError) {
    return (
      <ViewerShell>
        <Card className="mt-6 p-10" data-testid="payment-viewer-error">
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load this payment. Please try again."
            action={
              <Button size="md" onClick={() => payQ.refetch()} data-testid="payment-viewer-retry">Retry</Button>
            }
          />
        </Card>
      </ViewerShell>
    );
  }
  if (!payment || payment.status === "DRAFT") return null;

  const isCancelled = payment.status === "CANCELLED";
  const partyName = payment.partyId
    ? lookups.party(payment.partyId) || `${payment.partyId.slice(0, 8)} (name unavailable)`
    : "—";
  const depositName = payment.paymentAccountId
    ? lookups.accountName(payment.paymentAccountId) ?? `${payment.paymentAccountId.slice(0, 8)} (name unavailable)`
    : "—";

  async function onCancelConfirm(reason: string) {
    if (!payment) return;
    setBusy(true);
    setBanner(null);
    try {
      const result = await cancel.mutateAsync({ id: payment.id, reason, version: payment.version });
      setCancelOpen(false);
      toast(`Payment cancelled — reversal ${result.reversalEntryNo} recorded.`, "success");
    } catch (err) {
      setCancelOpen(false);
      const code = asApiError(err).code;
      const stale = code === "ALREADY_REVERSED" || code === "VOUCHER_NOT_POSTED";
      setBanner(stale ? "This payment has already been cancelled." : mapPaymentError(code).message);
      if (stale) payQ.refetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl pb-6" data-testid="payment-viewer">
      <Breadcrumb items={[{ label: "Payments", href: "/payments" }, { label: payment.entryNo ?? "Payment" }]} />
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1
          className="font-mono text-[23px] font-bold tracking-[-0.01em] text-foreground"
          data-testid="payment-viewer-title"
        >
          Payment {payment.entryNo ?? ""}
        </h1>
        <PaymentStatusBadge status={payment.status} />
        <Badge tone="info" className="font-mono">
          {payment.entryNo}
        </Badge>
      </div>

      {!online && (
        <Alert tone="warning" title="You're offline." className="mt-3" data-testid="payment-viewer-offline">
          Showing the last loaded payment. Cancel / Correct are disabled until you reconnect.
        </Alert>
      )}
      {banner && <Alert tone="destructive" title={banner} className="mt-3" data-testid="payment-viewer-banner" />}
      {isCancelled && (
        <div
          className="mt-3 flex flex-wrap items-center gap-3 rounded-card border border-border-strong bg-muted p-3.5"
          data-testid="payment-cancelled-ribbon"
        >
          <span className="inline-flex h-6 items-center gap-1.5 rounded-pill bg-border-strong px-2.5 text-[11px] font-bold uppercase tracking-[0.3px] text-muted-foreground">
            Superseded
          </span>
          <span className="text-[12.5px] text-muted-foreground">
            This payment was cancelled. Each settled payable&rsquo;s outstanding has risen back.
          </span>
        </div>
      )}

      <div
        className="mt-3 flex items-start gap-3 rounded-card border border-accent-soft bg-accent-soft/40 p-3"
        data-testid="payment-immutability-note"
      >
        <Lock className="mt-0.5 h-4 w-4 flex-none text-accent-ink" aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Posted payments can&rsquo;t be edited. To change this, cancel or correct it.
        </p>
      </div>

      <Card className="mt-4 p-5" data-testid="payment-viewer-header">
        <div className="flex flex-wrap items-start gap-6">
          <HeaderField label="Payee" value={partyName} minWidth={200} bn />
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Payment</div>
            <div className="mt-0.5 text-[14px] text-foreground">
              <PaymentModeBadge mode={payment.paymentMode} className="mr-1 inline-flex text-[13px] text-foreground" />
              {payment.chequeTxnRef ? ` · ${payment.chequeTxnRef}` : ""}
              <span className="ml-1 text-muted-foreground">({paymentModeLabel(payment.paymentMode)})</span>
            </div>
          </div>
          <HeaderField label="Paying account" value={depositName} />
          <HeaderField label="Date" value={formatDate(payment.paymentDate)} mono />
          <div className="ml-auto flex flex-col items-end gap-0.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Posted</span>
            <span className="font-mono text-[13px] tabular-nums text-foreground" data-testid="payment-viewer-posted-at">
              {payment.postedAt ? formatDateTime(payment.postedAt) : "—"}
            </span>
          </div>
        </div>
      </Card>

      <Card className="mt-4 p-5" data-testid="payment-money-summary">
        <div className="grid grid-cols-3 gap-6">
          <SummaryCell label="Total cash out" value={payment.paymentAmount} strong />
          <SummaryCell label="Allocated" value={payment.allocatedAmount} />
          <SummaryCell label="Unallocated" value={payment.unallocatedAmount} tone={payment.unallocatedAmount === "0.0000" ? "muted" : "warning"} />
        </div>
        {payment.narration && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Narration</div>
            <p className="bn mt-1 text-[13px] text-foreground [overflow-wrap:anywhere]">{payment.narration}</p>
          </div>
        )}
      </Card>

      <PaymentAllocationsPanel allocations={payment.allocations} />

      <PaymentLedgerLinesTable
        entry={entryQ.data}
        isLoading={entryQ.isLoading}
        errorCode={linesErrCode}
        ledgerHref={payment.journalEntryId ? `/ledger/entry-viewer?id=${payment.journalEntryId}` : null}
        onRetry={() => entryQ.refetch()}
      />

      <PaymentLinkagePanel linkage={payment.linkage} hrefForEntry={(id) => `/ledger/entry-viewer?id=${id}`} />

      <div className="mt-6 flex flex-wrap items-center gap-2.5" data-testid="payment-viewer-actions">
        <Button variant="outline" onClick={goBack} data-testid="payment-viewer-back">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to payments
        </Button>
        {payment.journalEntryId && (
          <Button variant="outline" asChild disabled={!online}>
            <Link href={`/ledger/entry-viewer?id=${payment.journalEntryId}`} data-testid="payment-viewer-view-in-ledger">
              <ExternalLink className="h-4 w-4" aria-hidden />
              View ledger entry
            </Link>
          </Button>
        )}
        {!isCancelled && canCancel && (
          <>
            <span className="mx-1 h-6 w-px bg-border-strong" aria-hidden />
            <Button variant="outline" asChild data-testid="payment-viewer-correct">
              <Link href={`/payments/${payment.id}`}>
                <Repeat className="h-4 w-4" aria-hidden />
                Correct payment
              </Link>
            </Button>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive-ink hover:bg-destructive-soft"
              onClick={() => setCancelOpen(true)}
              disabled={busy || !online}
              data-testid="payment-viewer-cancel"
            >
              <XCircle className="h-4 w-4" aria-hidden />
              Cancel payment
            </Button>
          </>
        )}
      </div>

      <CancelPaymentDialog
        open={cancelOpen}
        busy={busy}
        onConfirm={onCancelConfirm}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Payments", href: "/payments" }, { label: "Payment" }]} />
      <div className="mb-3 mt-1 flex items-center gap-3">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-6 w-20 rounded-pill" />
      </div>
      <Card className="mt-3 flex flex-wrap gap-6 p-5" data-testid="payment-viewer-loading">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        ))}
      </Card>
    </div>
  );
}

function ViewerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Payments", href: "/payments" }, { label: "Payment" }]} />
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

function SummaryCell({
  label,
  value,
  strong,
  tone = "default",
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "default" | "muted" | "warning";
}) {
  const cls = tone === "warning" ? "text-warning-ink" : tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">{label}</div>
      <div
        className={`mt-1 font-mono tabular-nums ${strong ? "text-[20px] font-bold" : "text-[15px] font-semibold"} ${cls}`}
      >
        {formatMoney(value)}
      </div>
    </div>
  );
}
