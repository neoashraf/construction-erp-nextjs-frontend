"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { History, HelpCircle, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { useOnline } from "@/lib/hooks/use-online";
import { useIsMobile } from "@/lib/hooks/use-media-query";
import { asApiError } from "@/lib/api";
import { roleLabel } from "@/lib/auth/roles";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canReviewRequisitions } from "../access";
import { useRequisition } from "../hooks/useRequisition";
import { useRequisitionApprovalMutations } from "../hooks/useRequisitionApprovalMutations";
import {
  useBudgetCheck,
  useItemOptions,
  useProjectOptions,
  useUserOptions,
} from "../hooks/useRequisitionOptions";
import {
  mapApprovalError,
  rejectReasonSchema,
  resolveApprovalAuthority,
  type ApprovalAuthority,
} from "../schemas/requisition-approval.schema";
import { TierBanner, TierPill } from "./TierBadge";
import { ApprovalActionBar } from "./ApprovalActionBar";
import { RejectReasonPanel, RejectReasonSheet } from "./RejectReasonDialog";
import { RequisitionLinesReadOnly } from "./RequisitionLinesReadOnly";
import { RequisitionStatusBadge } from "./RequisitionStatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { type BudgetStatus, type ItemOption, type Requisition } from "../types";

const WORKLIST = "/requisitions/approvals";
const ESCALATED_NOTE =
  "This requisition's estimated value is above your approval limit. It has been escalated to the Accounts team — you can view it, but only Accounts can approve or reject it.";

/**
 * Requisition review / approval detail (spec §4/§6/§9; FR-REQ-005…-011). Shows a SUBMITTED
 * requisition read-only (header + tier + estimated value + advisory budget + lines + narration)
 * and lets an authorised approver Approve (single click, optional note) or Reject (mandatory
 * reason). Escalate-by-default gating renders the action bar **disabled** (not hidden) with the
 * escalated note; the server re-validates every action. Both decisions are server-confirmed —
 * on success the screen redirects to the worklist rather than lingering on a stale view.
 */
export function RequisitionApprovalDetail({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  const online = useOnline();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const user = useAuthenticatedUser();

  const detail = useRequisition(requisitionId);
  const req = detail.data;

  const projectsQuery = useProjectOptions();
  const usersQuery = useUserOptions();
  const items = useItemOptions().data ?? [];
  const budget = useBudgetCheck(
    req?.projectId ?? "",
    req?.costCentreId ?? "",
    req?.estimatedValue ?? null,
  );

  const { approve, reject } = useRequisitionApprovalMutations();

  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<"approve" | "reject" | null>(null);
  const [raced, setRaced] = useState(false);
  const [busy, setBusy] = useState(false);

  // ── Permission-denied (non-approver hitting the screen directly) ──
  if (!canReviewRequisitions(user)) {
    return <PermissionDenied />;
  }

  // ── Loading ──
  if (detail.isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="mb-4 h-7 w-72" />
        <div className="flex flex-col gap-4" data-testid="req-approval-loading">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-28 w-full" />
          <Card className="flex flex-col gap-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </Card>
        </div>
      </div>
    );
  }

  // ── Load error ──
  if (detail.isError || !req) {
    const e = asApiError(detail.error);
    if (e.code === "FORBIDDEN") return <PermissionDenied />;
    return (
      <div className="mx-auto max-w-5xl">
        <Breadcrumb items={[{ label: "Requisitions", href: WORKLIST }, { label: "Requisition" }]} />
        <Card
          className="mt-6 flex flex-col items-center gap-3 p-10 text-center"
          data-testid="req-approval-error"
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
            onClick={() => detail.refetch()}
            data-testid="req-approval-retry"
          >
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const projects = projectsQuery.data;
  const users = usersQuery.data;
  const projectName = resolveName(projects, req.projectId, (p) => p.name);
  const requesterName = resolveName(users, req.submittedById, (u) => u.name);
  const itemMap = new Map<string, ItemOption>(items.map((i) => [i.id, i]));

  const decided = raced || req.status !== "SUBMITTED";
  let authority = resolveApprovalAuthority(user, req);
  if (raced && authority.canDecide) {
    authority = { canDecide: false, reason: "already-decided", tier: authority.tier };
  }
  const canDecide = authority.canDecide;

  function handleDecisionError(err: unknown) {
    const mapped = mapApprovalError(asApiError(err).code);
    if (mapped.raced) {
      setRaced(true);
      setRejecting(false);
      void detail.refetch();
    }
    setBanner(mapped.message);
  }

  async function onApprove() {
    if (!req) return;
    if (!online) {
      setBanner("You're offline. Your decision wasn't recorded.");
      return;
    }
    setBanner(null);
    setLastAction("approve");
    setBusy(true);
    try {
      await approve.mutateAsync({ id: req.id, note: note.trim() || null, version: req.version });
      toast("Requisition approved.", "success");
      router.push(WORKLIST);
    } catch (err) {
      handleDecisionError(err);
    } finally {
      setBusy(false);
    }
  }

  async function onRejectConfirm() {
    if (!req) return;
    const parsed = rejectReasonSchema.safeParse({ reason: rejectReason });
    if (!parsed.success) {
      setRejectError(
        parsed.error.issues[0]?.message ?? "Enter a reason for rejecting this requisition.",
      );
      return;
    }
    if (!online) {
      setBanner("You're offline. Your decision wasn't recorded.");
      return;
    }
    setRejectError(null);
    setLastAction("reject");
    setBusy(true);
    try {
      await reject.mutateAsync({ id: req.id, reason: parsed.data.reason, version: req.version });
      toast("Requisition rejected.", "success");
      router.push(WORKLIST);
    } catch (err) {
      const mapped = mapApprovalError(asApiError(err).code);
      if (mapped.field === "reason") {
        setRejectError(mapped.message);
      } else {
        setRejecting(false);
        handleDecisionError(err);
      }
    } finally {
      setBusy(false);
    }
  }

  function startReject() {
    setBanner(null);
    setRejectError(null);
    setRejecting(true);
  }
  function cancelReject() {
    setRejecting(false);
    setRejectError(null);
  }

  const rejectProps = {
    reason: rejectReason,
    onReasonChange: setRejectReason,
    error: rejectError,
    requisitionNo: req.requisitionNo ?? "this requisition",
    requesterName: requesterName.text,
    busy,
    onCancel: cancelReject,
    onConfirm: onRejectConfirm,
  };

  return (
    <div className="mx-auto max-w-5xl pb-28 lg:pb-6">
      <Breadcrumb
        items={[
          { label: "Requisitions", href: WORKLIST },
          { label: req.requisitionNo ?? "Requisition" },
        ]}
      />

      {/* Title row */}
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-[22px] font-bold tracking-[-0.02em]" data-testid="req-approval-title">
          Review requisition {req.requisitionNo ?? ""}
        </h1>
        <RequisitionStatusBadge status={req.status} />
        <PriorityBadge priority={req.priority} />
        <Button variant="outline" size="sm" asChild className="ml-auto gap-1.5">
          <Link href={`/requisitions/${req.id}`} data-testid="req-view-history">
            <History className="h-4 w-4" aria-hidden />
            View history
          </Link>
        </Button>
      </div>

      {!online && (
        <Alert
          tone="warning"
          className="mb-4"
          title="You're offline. Your decision wasn't recorded."
          data-testid="req-offline"
        >
          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            Approve and Reject are paused until you reconnect.
          </span>
        </Alert>
      )}

      {decided && (
        <Alert
          tone="info"
          className="mb-4"
          title="This requisition has already been decided."
          data-testid="req-decided-banner"
        >
          <div className="flex flex-col items-start gap-2">
            <span className="text-[12.5px]">
              Another approver recorded a decision while this was open. Showing the current
              read-only state — no action is available.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => detail.refetch()}
              data-testid="req-decided-refresh"
            >
              Refresh
            </Button>
          </div>
        </Alert>
      )}

      {banner && !decided && (
        <Alert
          tone="destructive"
          className="mb-4"
          title="Couldn't record your decision. Please try again."
          data-testid="req-decision-error"
        >
          <div className="flex flex-col items-start gap-2">
            <span className="text-[12.5px]">{banner}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => (lastAction === "reject" ? startReject() : onApprove())}
              disabled={busy}
              data-testid="req-decision-retry"
            >
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* Tier banner — load-bearing (announced first, aria-live) */}
      <TierBanner variant={tierVariant(authority)} title={tierTitle(authority)} className="mb-4">
        {tierBody(authority, req, user, projectName.text)}
      </TierBanner>

      {/* Header detail */}
      <Card className="mb-4 grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Requisition no" value={req.requisitionNo ?? "—"} />
        <Field label="Project" value={projectName.node} />
        <Field label="Requested by" value={requesterName.node} />
        <Field label="Priority">
          <PriorityBadge priority={req.priority} />
        </Field>
        <Field label="Required by" value={safeDate(req.requiredDate)} />
        <Field
          label="Submitted"
          value={
            req.submittedAt
              ? `${safeDate(req.submittedAt)}${canDecide ? " · notified you by SMS" : ""}`
              : "—"
          }
        />
      </Card>

      {/* Estimated value + advisory budget */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Card className="flex items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              Estimated value
            </div>
            <div
              className="mt-0.5 font-mono text-[22px] font-bold tabular-nums text-foreground"
              data-testid="req-approval-estimate"
            >
              {req.estimatedValue != null ? formatMoney(req.estimatedValue) : "—"}
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              The value this requisition&apos;s approval tier was resolved against.
            </div>
          </div>
          {req.approvalTier && <TierPill tier={req.approvalTier} className="flex-none" />}
        </Card>
        <BudgetPanel status={budget.data} />
      </div>

      {/* Material lines */}
      <Card className="mb-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-foreground">Material lines</h2>
          <span className="rounded-pill bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {req.lines?.length ?? 0} {req.lines?.length === 1 ? "line" : "lines"}
          </span>
          <span className="ml-auto text-[12px] text-muted-foreground">
            Read-only · lines can&apos;t be edited during review.
          </span>
        </div>
        {req.lines && req.lines.length > 0 ? (
          <>
            <RequisitionLinesReadOnly lines={req.lines} items={itemMap} />
            <div className="flex items-center justify-end gap-3 border-t border-border-strong bg-surface-2 px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                Estimated total
              </span>
              <span
                className="font-mono text-[15px] font-bold tabular-nums text-foreground"
                data-testid="req-approval-total"
              >
                {req.estimatedValue != null ? formatMoney(req.estimatedValue) : "—"}
              </span>
            </div>
          </>
        ) : (
          <div className="px-4 py-6 text-[13px] text-muted-foreground" data-testid="req-no-lines">
            This requisition has no material lines.
          </div>
        )}
      </Card>

      {/* Narration */}
      {req.narration && (
        <Card className="mb-4 p-5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
            Narration
          </div>
          <p className="mt-1 text-[14px] leading-relaxed text-foreground [overflow-wrap:anywhere]">
            {req.narration}
          </p>
        </Card>
      )}

      {/* ── Decision region (desktop / tablet) ── */}
      <div className="hidden lg:block">
        {rejecting && canDecide ? (
          <RejectReasonPanel {...rejectProps} />
        ) : (
          <>
            {canDecide && (
              <Card className="mb-4 p-5">
                <label
                  htmlFor="req-approval-note"
                  className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
                >
                  Approval note{" "}
                  <span className="font-normal normal-case tracking-normal text-faint">
                    (optional)
                  </span>
                </label>
                <Textarea
                  id="req-approval-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="mt-2"
                  placeholder="Add a note for the record…"
                  data-testid="req-approval-note"
                />
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  Recorded with your decision and visible in the approval trail.
                </p>
              </Card>
            )}
            <Card className="p-5">
              <ApprovalActionBar
                authority={authority}
                busy={busy}
                onApprove={onApprove}
                onReject={startReject}
              />
            </Card>
          </>
        )}
      </div>

      {/* ── Decision region (mobile sticky bar + full-screen reject sheet) ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-3 shadow-lg lg:hidden">
        <ApprovalActionBar
          authority={authority}
          busy={busy}
          onApprove={onApprove}
          onReject={startReject}
          showHelper={false}
        />
      </div>
      <RejectReasonSheet
        open={isMobile && rejecting && canDecide}
        onOpenChange={(o) => !o && cancelReject()}
        {...rejectProps}
      />
    </div>
  );
}

// ── Tier banner text ──
function tierVariant(a: ApprovalAuthority): "in-tier" | "escalated" | "neutral" {
  if (a.canDecide) return "in-tier";
  if (a.reason === "escalated") return "escalated";
  return "neutral";
}
function tierTitle(a: ApprovalAuthority): string {
  if (a.canDecide) return "Within your approval limit";
  if (a.reason === "escalated") return "Escalated to Accounts";
  return a.tier === "ACCOUNTS" ? "Accounts approval tier" : "Project Manager approval tier";
}
function tierBody(
  a: ApprovalAuthority,
  req: Requisition,
  user: ReturnType<typeof useAuthenticatedUser>,
  projectName: string,
): string {
  const est = req.estimatedValue != null ? formatMoney(req.estimatedValue) : "the estimated value";
  if (a.canDecide) {
    const who = roleLabel(user.role);
    const limit = user.approvalLimit ? formatMoney(user.approvalLimit) : null;
    const clause = limit ? `is at or below your ${limit} limit` : "is within your approval limit";
    return `Total ${est} ${clause} as ${who} on ${projectName}. Approving records an approval decision only — it posts no ledger entry.`;
  }
  if (a.reason === "escalated") return ESCALATED_NOTE;
  const routedTo = a.tier === "ACCOUNTS" ? "the Accounts team" : "the assigned Project Manager";
  return `This requisition was routed to ${routedTo} for a decision.`;
}

// ── Small presentational helpers ──
function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: React.ReactNode;
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

interface ResolvedName {
  text: string;
  node: React.ReactNode;
}
/** Resolve an id to a display name, or the id + muted "(name unavailable)" once options load. */
function resolveName<T extends { id: string }>(
  options: T[] | undefined,
  id: string | null,
  pick: (o: T) => string,
): ResolvedName {
  if (!id) return { text: "—", node: "—" };
  const found = options?.find((o) => o.id === id);
  if (found) {
    const text = pick(found);
    return { text, node: text };
  }
  if (!options) {
    // Still loading — show the id stub without the "(name unavailable)" verdict yet.
    const stub = id.slice(0, 8);
    return { text: stub, node: stub };
  }
  const stub = id.slice(0, 8);
  return {
    text: stub,
    node: (
      <span>
        {stub} <span className="text-faint">(name unavailable)</span>
      </span>
    ),
  };
}

function safeDate(value: string): string {
  try {
    return formatDate(value);
  } catch {
    return value;
  }
}

const BUDGET: Record<BudgetStatus, { box: string; title: string; label: string; body: string }> = {
  OK: {
    box: "border-border bg-surface-2",
    title: "text-foreground",
    label: "Within budget",
    body: "This cost centre is within its allotted budget.",
  },
  APPROACHING: {
    box: "border-border bg-warning-soft",
    title: "text-warning-ink",
    label: "Approaching budget",
    body: "This cost centre is near its allotted budget.",
  },
  OVER: {
    box: "border-border bg-destructive-soft",
    title: "text-destructive-ink",
    label: "Over budget",
    body: "This cost centre is above its allotted budget.",
  },
};

/** Advisory over-budget panel (FR-REQ-005; CC FR-CC-014). Advisory only — never blocks. */
function BudgetPanel({ status }: { status: BudgetStatus | undefined }) {
  const s = BUDGET[status ?? "OK"];
  const dot =
    status === "OVER"
      ? "bg-destructive"
      : status === "APPROACHING"
        ? "bg-warning"
        : "bg-muted-foreground";
  return (
    <div
      className={cn("flex items-start gap-2 rounded-card border p-4", s.box)}
      data-testid={`req-budget-panel-${status ?? "OK"}`}
      title="This is a heads-up only — you can still approve or reject."
    >
      <span className={cn("mt-1.5 h-2 w-2 flex-none rounded-full", dot)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm font-semibold", s.title)}>{s.label}</span>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </div>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground [overflow-wrap:anywhere]">
          {s.body}
        </p>
      </div>
    </div>
  );
}

function PermissionDenied() {
  return (
    <div className="mx-auto max-w-5xl">
      <Breadcrumb items={[{ label: "Requisitions", href: WORKLIST }, { label: "Review" }]} />
      <Card
        className="mt-6 flex flex-col items-center gap-3 p-10 text-center"
        data-testid="req-approval-403"
      >
        <p className="text-[15px] font-semibold text-foreground">
          You don&apos;t have permission to review this requisition.
        </p>
        <p className="max-w-sm text-[13px] text-muted-foreground">
          Ask an administrator if you think you should have access.
        </p>
        <Button size="md" variant="outline" asChild>
          <Link href={WORKLIST}>Back to approvals</Link>
        </Button>
      </Card>
    </div>
  );
}
