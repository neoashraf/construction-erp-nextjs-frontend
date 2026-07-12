"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { History, WifiOff, PackageCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { formatQty, toDecimal } from "@/lib/money";
import { useOnline } from "@/lib/hooks/use-online";
import { useIsMobile } from "@/lib/hooks/use-media-query";
import { asApiError } from "@/lib/api";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  canCloseRequisition,
  canIssueRequisition,
  canOverrideNegativeStock,
  canReverseIssue,
  canViewIssues,
} from "../access";
import { useRequisition } from "../hooks/useRequisition";
import { useRequisitionApprovals } from "../hooks/useRequisitionApprovals";
import { useRequisitionOutstanding } from "../hooks/useRequisitionOutstanding";
import { useRequisitionIssues, useOnHandBalances } from "../hooks/useRequisitionIssues";
import { useRequisitionIssueMutations } from "../hooks/useRequisitionIssueMutations";
import {
  useCostCentreOptions,
  useGodownOptions,
  useItemOptions,
  useProjectOptions,
  usePurposeOptions,
  useUserOptions,
} from "../hooks/useRequisitionOptions";
import {
  isIssuable,
  mapIssueError,
  validateIssueQuantity,
} from "../schemas/requisition-issue.schema";
import { RequisitionStatusBadge } from "./RequisitionStatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { IssueForm } from "./IssueForm";
import { OutstandingBalanceView } from "./OutstandingBalanceView";
import { StatusTrail } from "./StatusTrail";
import { ManualCloseDialog } from "./ManualCloseDialog";
import { ReverseIssueDialog } from "./ReverseIssueDialog";
import { type IssueLineState } from "./IssueLineCard";
import { type ItemOption, type RequisitionIssue } from "../types";

const WORKLIST = "/requisitions/issues";

/**
 * Requisition issue detail (spec §4/§5/§6; FR-REQ-012…-023) — three regions on one page:
 * (A) the atomic issue form, (B) outstanding balance + Manual Close, (C) the status &
 * notification trail with Reverse. The only REQ point that moves stock + posts a consumption
 * entry — all server-side inside the `…/issue` transaction; the FE drives the UI and renders the
 * returned `entryNo`/value/rate. Every write is server-confirmed; no partial/half-issued UI state.
 */
export function RequisitionIssueDetail({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  const online = useOnline();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const user = useAuthenticatedUser();

  const detail = useRequisition(requisitionId);
  const req = detail.data;
  const outstanding = useRequisitionOutstanding(requisitionId);
  const approvals = useRequisitionApprovals(requisitionId);
  const issuesQuery = useRequisitionIssues(requisitionId);

  const projects = useProjectOptions().data ?? [];
  const itemsData = useItemOptions().data;
  const usersData = useUserOptions().data;
  const costCentres = useCostCentreOptions().data ?? [];
  const purposes = usePurposeOptions(req?.projectId ?? "").data ?? [];
  const godowns = useGodownOptions(req?.projectId || undefined).data ?? [];

  const { issue, reverse, close } = useRequisitionIssueMutations();

  const canView = canViewIssues(user);
  const canIssue = canIssueRequisition(user);
  const canClose = canCloseRequisition(user);
  const canReverse = canReverseIssue(user);
  const canOverride = canOverrideNegativeStock(user);

  const [headerGodownId, setHeaderGodownId] = useState("");
  const [lines, setLines] = useState<IssueLineState[]>([]);
  const [neg, setNeg] = useState({ enabled: false, reason: "", error: null as string | null });
  const [banner, setBanner] = useState<string | null>(null);
  const [result, setResult] = useState<RequisitionIssue | null>(null);
  const [busy, setBusy] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [reverseTarget, setReverseTarget] = useState<{ issueId: string; entryNo: string } | null>(
    null,
  );
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const itemMap = useMemo(
    () => new Map<string, ItemOption>((itemsData ?? []).map((i) => [i.id, i])),
    [itemsData],
  );
  const userMap = useMemo(() => new Map((usersData ?? []).map((u) => [u.id, u])), [usersData]);
  const lineItems = useLineItemMap(req?.lines ?? [], itemMap);

  // Seed the header godown from the requisition once loaded.
  useEffect(() => {
    if (req?.fromGodownId && !headerGodownId) setHeaderGodownId(req.fromGodownId);
  }, [req?.fromGodownId, headerGodownId]);

  // (Re)build the editable issue lines from the outstanding balance (resets quantities after an
  // issue — the refetch drives this). Only lines with a positive balance are issuable.
  const outstandingData = outstanding.data;
  useEffect(() => {
    if (!outstandingData) return;
    const g = headerGodownId || req?.fromGodownId || "";
    setLines(
      outstandingData.lines
        .filter((l) => toDecimal(l.balanceQuantity).gt(0))
        .map((l) => ({
          requisitionLineId: l.requisitionLineId,
          itemId: l.itemId,
          uom: l.uom,
          balance: l.balanceQuantity,
          godownId: g,
          quantity: "0.0000",
          error: null,
        })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outstandingData]);

  const onHandPairs = lines.map((l) => ({ godownId: l.godownId, itemId: l.itemId }));
  const onHand = useOnHandBalances(onHandPairs);

  const readyCount = lines.filter((l) => isIssuable(l.quantity)).length;

  // ── Guards / async states (all hooks are above this line) ──
  if (!canView) return <PermissionDenied />;

  if (detail.isLoading || (req && outstanding.isLoading)) {
    return <IssueSkeleton />;
  }
  if (detail.isError || !req) {
    const e = asApiError(detail.error);
    if (e.code === "FORBIDDEN") return <PermissionDenied />;
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={[{ label: "Requisitions", href: WORKLIST }, { label: "Requisition" }]} />
        <Card
          className="mt-6 flex flex-col items-center gap-3 p-10 text-center"
          data-testid="req-issue-error"
        >
          <p className="text-[15px] font-semibold text-foreground">
            Couldn&apos;t load this requisition.
          </p>
          <p className="max-w-sm text-[13px] text-muted-foreground">
            Check your connection and try again.
          </p>
          <Button
            size="md"
            variant="outline"
            onClick={() => {
              void detail.refetch();
              void outstanding.refetch();
            }}
            data-testid="req-issue-retry"
          >
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const status = req.status;
  const showIssueForm = canIssue && (status === "APPROVED" || status === "PARTIALLY_ISSUED");
  const fullyIssued = status === "ISSUED";
  const closed = status === "CLOSED";
  const projectName =
    projects.find((p) => p.id === req.projectId)?.name ?? req.projectId.slice(0, 8);
  const ccName = costCentres.find((c) => c.id === req.costCentreId)?.name;
  const purposeName = purposes.find((p) => p.id === req.purposeId)?.name;
  const requesterName = req.submittedById
    ? (userMap.get(req.submittedById)?.name ?? req.submittedById.slice(0, 8))
    : "—";

  function patchLine(lineId: string, patch: Partial<IssueLineState>) {
    setLines((prev) =>
      prev.map((l) =>
        l.requisitionLineId === lineId
          ? { ...l, ...patch, error: patch.quantity !== undefined ? null : l.error }
          : l,
      ),
    );
  }
  function changeHeaderGodown(id: string) {
    setHeaderGodownId(id);
    setLines((prev) => prev.map((l) => ({ ...l, godownId: id })));
  }

  function handleIssueError(err: unknown) {
    const mapped = mapIssueError(asApiError(err).code);
    setBanner(mapped.message);
    if (mapped.refresh) {
      void outstanding.refetch();
      void detail.refetch();
    }
  }

  async function onIssue() {
    if (!req) return;
    if (!online) {
      setBanner("You're offline. Nothing was issued.");
      return;
    }
    // Client-side per-line validation (edge 2 — block before firing).
    let hasError = false;
    const validated = lines.map((l) => {
      if (!isIssuable(l.quantity)) return { ...l, error: null };
      const err = !l.godownId
        ? "Select a source godown."
        : validateIssueQuantity(l.quantity, l.balance);
      if (err) hasError = true;
      return { ...l, error: err };
    });
    setLines(validated);
    const issuing = validated.filter((l) => isIssuable(l.quantity));
    if (hasError || issuing.length === 0) return;
    if (neg.enabled && neg.reason.trim() === "") {
      setNeg((n) => ({ ...n, error: "Enter a reason for issuing beyond on-hand stock." }));
      return;
    }

    setBanner(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await issue.mutateAsync({
        id: req.id,
        input: {
          fromGodownId: headerGodownId,
          lines: issuing.map((l) => ({
            requisitionLineId: l.requisitionLineId,
            issueQuantity: toDecimal(l.quantity).toFixed(4),
            godownId: l.godownId !== headerGodownId ? l.godownId : undefined,
          })),
          allowNegativeStock: neg.enabled,
          negativeStockReason: neg.enabled ? neg.reason.trim() : null,
          version: req.version,
        },
      });
      setResult(res);
      setNeg({ enabled: false, reason: "", error: null });
      toast("Material issued.", "success");
    } catch (err) {
      handleIssueError(err);
    } finally {
      setBusy(false);
    }
  }

  async function onCloseConfirm(reason: string) {
    if (!req) return;
    if (!online) {
      setCloseError("You're offline. Nothing was changed.");
      return;
    }
    setCloseError(null);
    setBusy(true);
    try {
      await close.mutateAsync({ id: req.id, reason, version: req.version });
      toast("Requisition closed.", "success");
      setCloseOpen(false);
      router.push(WORKLIST);
    } catch (err) {
      setCloseError(mapIssueError(asApiError(err).code).message);
    } finally {
      setBusy(false);
    }
  }

  async function onReverseConfirm(reason: string) {
    if (!req || !reverseTarget) return;
    if (!online) {
      setReverseError("You're offline. Nothing was changed.");
      return;
    }
    setReverseError(null);
    setBusy(true);
    try {
      await reverse.mutateAsync({
        id: req.id,
        issueId: reverseTarget.issueId,
        reason,
        version: req.version,
      });
      toast("Issue reversed.", "success");
      setReverseTarget(null);
    } catch (err) {
      setReverseError(mapIssueError(asApiError(err).code).message);
    } finally {
      setBusy(false);
    }
  }

  const outstandingCount = outstandingData
    ? outstandingData.lines.filter((l) => toDecimal(l.balanceQuantity).gt(0)).length
    : 0;

  const trail = outstandingData && (
    <StatusTrail
      requisition={req}
      approvals={approvals.data ?? []}
      issues={issuesQuery.data ?? []}
      users={userMap}
      canReverse={canReverse && !closed}
      onReverse={(issueId, entryNo) => {
        setReverseError(null);
        setReverseTarget({ issueId, entryNo });
      }}
    />
  );

  return (
    <div className="mx-auto max-w-6xl pb-28 lg:pb-6">
      <Breadcrumb
        items={[
          { label: "Requisitions", href: WORKLIST },
          { label: req.requisitionNo ?? "Requisition" },
        ]}
      />

      <div className="mb-4 mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-[22px] font-bold tracking-[-0.02em]" data-testid="req-issue-title">
          Issue requisition {req.requisitionNo ?? ""}
        </h1>
        <RequisitionStatusBadge status={status} />
        <PriorityBadge priority={req.priority} />
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5 lg:hidden"
          onClick={() => setHistoryOpen(true)}
          data-testid="req-view-history"
        >
          <History className="h-4 w-4" aria-hidden />
          View history
        </Button>
      </div>

      {!online && (
        <Alert
          tone="warning"
          className="mb-4"
          title="You're offline. Nothing was issued."
          data-testid="req-offline"
        >
          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            Issue and close are paused until you reconnect.
          </span>
        </Alert>
      )}

      {/* Header detail + posting dimensions */}
      <Card className="mb-4 flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <dl className="grid flex-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Requisition no" value={req.requisitionNo ?? "—"} />
          <Field label="Project" value={projectName} />
          <Field label="Requested by" value={requesterName} />
          <Field label="Priority">
            <PriorityBadge priority={req.priority} />
          </Field>
        </dl>
        <div className="lg:text-right">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
            Posting dimensions
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 lg:justify-end">
            <Dim>{projectName}</Dim>
            {ccName && <Dim>CC · {ccName}</Dim>}
            {purposeName && <Dim>Purpose · {purposeName}</Dim>}
          </div>
        </div>
      </Card>

      {banner && (
        <Alert
          tone="destructive"
          className="mb-4"
          title="Couldn't complete the issue. Please try again."
          data-testid="req-issue-banner"
        >
          <div className="flex flex-col items-start gap-2">
            <span className="text-[12.5px]">{banner}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBanner(null)}
              data-testid="req-issue-dismiss"
            >
              Dismiss
            </Button>
          </div>
        </Alert>
      )}

      {(fullyIssued || closed) && (
        <Alert
          tone={closed ? "info" : "success"}
          className="mb-4"
          title={
            closed
              ? "This requisition is closed."
              : "This requisition is fully issued. Nothing left to issue."
          }
          data-testid="req-issue-done"
        >
          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
            <PackageCheck className="h-3.5 w-3.5" aria-hidden />
            {closed
              ? "The remaining balance was abandoned."
              : "All material lines have been issued."}
          </span>
        </Alert>
      )}

      {/* Mobile outstanding summary strip */}
      {!showIssueForm ? null : (
        <div
          className="mb-4 flex items-center gap-3 rounded-card border border-border bg-surface-2 px-4 py-3 lg:hidden"
          data-testid="req-outstanding-strip"
        >
          <span
            className="grid h-9 w-9 flex-none place-items-center rounded-token bg-warning-soft text-warning"
            aria-hidden
          >
            <PackageCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0 text-[13px]">
            <div className="font-semibold text-foreground">
              {outstandingCount} of {outstandingData?.lines.length ?? 0} lines outstanding
            </div>
            <div className="text-muted-foreground">
              {outstandingData
                ? `৳ ${formatQty(outstandingData.totalOutstandingValueIndicative, 2)} indicative balance`
                : ""}
            </div>
          </div>
        </div>
      )}

      {showIssueForm && outstandingData && (
        <div className="mb-4">
          <IssueForm
            headerGodownId={headerGodownId}
            onHeaderGodownChange={changeHeaderGodown}
            godowns={godowns}
            items={itemMap}
            lines={lines}
            onLineChange={patchLine}
            onHand={onHand}
            canOverride={canOverride}
            neg={neg}
            onNegToggle={(on) => setNeg((n) => ({ ...n, enabled: on, error: null }))}
            onNegReasonChange={(v) => setNeg((n) => ({ ...n, reason: v, error: null }))}
            onIssue={onIssue}
            busy={busy}
            result={result}
            lineItems={lineItems}
          />
        </div>
      )}

      {/* (B) + (C) — side by side on desktop, stacked on mobile (trail behind the sheet) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {outstandingData && (
          <OutstandingBalanceView
            outstanding={outstandingData}
            items={itemMap}
            canClose={canClose}
            onManualClose={() => {
              setCloseError(null);
              setCloseOpen(true);
            }}
          />
        )}
        <Card className="hidden flex-col overflow-hidden lg:flex" data-testid="req-trail-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span
              className="grid h-6 w-6 flex-none place-items-center rounded-token bg-primary text-[11px] font-bold text-primary-foreground"
              aria-hidden
            >
              C
            </span>
            <h2 className="text-sm font-bold text-foreground">Status &amp; notification trail</h2>
          </div>
          <div className="p-5">{trail}</div>
        </Card>
      </div>

      {/* Mobile sticky Issue bar */}
      {showIssueForm && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-3 shadow-lg lg:hidden">
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={onIssue}
            disabled={busy || readyCount === 0}
            aria-busy={busy || undefined}
            data-testid="req-issue-mobile"
          >
            <span aria-live="polite">
              {busy
                ? "Posting consumption…"
                : `Issue ${readyCount} item${readyCount === 1 ? "" : "s"}`}
            </span>
          </Button>
        </div>
      )}

      {/* Mobile history sheet */}
      <Sheet open={isMobile && historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent
          className="inset-x-0 bottom-0 left-0 right-0 top-auto h-auto max-h-[92%] w-full max-w-full rounded-t-card data-[state=open]:animate-[toastIn_0.24s_ease] lg:hidden"
          data-testid="req-history-sheet"
        >
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <h2 className="text-base font-bold text-foreground">History</h2>
            <span className="text-[12.5px] text-muted-foreground">{req.requisitionNo}</span>
          </div>
          <div className="flex-1 overflow-auto px-5 py-4">{trail}</div>
        </SheetContent>
      </Sheet>

      <ManualCloseDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        totalOutstanding={outstandingData?.totalOutstandingValueIndicative ?? "0"}
        busy={busy}
        error={closeError}
        onConfirm={onCloseConfirm}
      />
      <ReverseIssueDialog
        open={!!reverseTarget}
        onOpenChange={(o) => !o && setReverseTarget(null)}
        entryNo={reverseTarget?.entryNo ?? null}
        busy={busy}
        error={reverseError}
        onConfirm={onReverseConfirm}
      />
    </div>
  );
}

/** requisitionLineId → the line's item, for the issue-result summary. */
function useLineItemMap(
  lines: { id?: string; itemId: string }[],
  items: Map<string, ItemOption>,
): Map<string, ItemOption> {
  return useMemo(() => {
    const m = new Map<string, ItemOption>();
    for (const l of lines) {
      const it = items.get(l.itemId);
      if (l.id && it) m.set(l.id, it);
    }
    return m;
  }, [lines, items]);
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-[14px] text-foreground [overflow-wrap:anywhere]">
        {children ?? value}
      </div>
    </div>
  );
}

function Dim({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-pill bg-success-soft px-2.5 py-1 text-[11.5px] font-medium text-success-ink [overflow-wrap:anywhere]">
      {children}
    </span>
  );
}

function IssueSkeleton() {
  return (
    <div className="mx-auto max-w-6xl" data-testid="req-issue-loading">
      <Skeleton className="mb-3 h-4 w-40" />
      <Skeleton className="mb-4 h-7 w-72" />
      <Skeleton className="mb-4 h-20 w-full" />
      <Card className="mb-4 flex flex-col gap-3 p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

function PermissionDenied() {
  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Requisitions", href: WORKLIST }, { label: "Issue" }]} />
      <Card
        className="mt-6 flex flex-col items-center gap-3 p-10 text-center"
        data-testid="req-issue-403"
      >
        <p className="text-[15px] font-semibold text-foreground">
          You don&apos;t have permission to issue this requisition.
        </p>
        <p className="max-w-sm text-[13px] text-muted-foreground">
          Ask an administrator if you think you should have access.
        </p>
        <Button size="md" variant="outline" asChild>
          <Link href={WORKLIST}>Back to issues</Link>
        </Button>
      </Card>
    </div>
  );
}
