"use client";

import { Check, CircleDot, RotateCcw, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import {
  type Requisition,
  type RequisitionApproval,
  type RequisitionIssue,
  type UserOption,
} from "../types";

/**
 * (C) Status & notification trail (spec §5C/§8; FR-REQ-023). A semantic ordered timeline
 * derived from the requisition timestamps + approval history + issue history: submitted →
 * approved/rejected → each issue (with value, partial/full, reversal) → closed. Each transition
 * shows a "Notification sent to {role}" marker (trigger only, never delivery — SRS §2). A posted
 * issue carries a Reverse action for authorised viewers; a reversed issue is struck + badged.
 */

interface TrailNode {
  key: string;
  state: "done" | "reversed" | "pending";
  label: string;
  meta: string;
  reason?: string | null;
  value?: string | null;
  notify?: string | null;
  reverse?: { issueId: string; entryNo: string } | null;
  reversedNote?: string | null;
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return formatDateTime(iso);
  } catch {
    return iso;
  }
}

function buildTrail(
  requisition: Requisition,
  approvals: RequisitionApproval[],
  issues: RequisitionIssue[],
  users: Map<string, UserOption>,
  canReverse: boolean,
): TrailNode[] {
  const name = (id: string | null | undefined) =>
    id ? (users.get(id)?.name ?? id.slice(0, 8)) : "—";
  const nodes: TrailNode[] = [];

  if (requisition.submittedAt) {
    nodes.push({
      key: "submitted",
      state: "done",
      label: "Submitted",
      meta: `${name(requisition.submittedById)} · ${fmt(requisition.submittedAt)}`,
      notify: "the approver",
    });
  }

  for (const a of approvals) {
    nodes.push({
      key: `appr-${a.id}`,
      state: "done",
      label: a.decision === "APPROVED" ? "Approved" : "Rejected",
      meta: `${name(a.decidedById)} · ${fmt(a.decidedAt)} · ${a.tier} tier`,
      reason: a.decision === "REJECTED" ? a.reason : null,
      notify: a.decision === "APPROVED" ? "the Store Keeper" : "the requester",
    });
  }

  for (const iss of issues) {
    const reversed = !!iss.reversedAt;
    const full = iss.requisitionStatus === "ISSUED";
    nodes.push({
      key: `iss-${iss.requisitionIssueId}`,
      state: reversed ? "reversed" : "done",
      label: `Issued (${full ? "full" : "partial"})`,
      meta: `${fmt(iss.issuedAt)} · entry ${iss.entryNo}`,
      value: iss.issuedValue,
      notify: "the requester",
      reverse:
        !reversed && canReverse ? { issueId: iss.requisitionIssueId, entryNo: iss.entryNo } : null,
      reversedNote: reversed ? `Reversed ${fmt(iss.reversedAt)}` : null,
    });
  }

  if (requisition.closedAt) {
    nodes.push({
      key: "closed",
      state: "done",
      label: "Closed",
      meta: fmt(requisition.closedAt),
      reason: requisition.closedReason,
      notify: "the requester",
    });
  } else if (
    issues.length === 0 &&
    requisition.status !== "REJECTED" &&
    requisition.status !== "DRAFT"
  ) {
    nodes.push({
      key: "issue-pending",
      state: "pending",
      label: "Issue",
      meta: "Store Keeper · pending",
      reason: "Awaiting issue — nothing issued yet.",
    });
  }

  return nodes;
}

export function StatusTrail({
  requisition,
  approvals,
  issues,
  users,
  canReverse,
  onReverse,
}: {
  requisition: Requisition;
  approvals: RequisitionApproval[];
  issues: RequisitionIssue[];
  users: Map<string, UserOption>;
  canReverse: boolean;
  onReverse: (issueId: string, entryNo: string) => void;
}) {
  const nodes = buildTrail(requisition, approvals, issues, users, canReverse);

  return (
    <ol className="flex flex-col" data-testid="req-trail">
      {nodes.map((n, i) => {
        const last = i === nodes.length - 1;
        return (
          <li key={n.key} className="flex gap-3" data-testid={`req-trail-${n.key}`}>
            <div className="flex flex-none flex-col items-center">
              <span
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full",
                  n.state === "done" && "bg-success-soft text-success",
                  n.state === "reversed" && "bg-muted text-muted-foreground",
                  n.state === "pending" && "border border-border-strong bg-surface text-faint",
                )}
                aria-hidden
              >
                {n.state === "reversed" ? (
                  <RotateCcw className="h-3 w-3" />
                ) : n.state === "pending" ? (
                  <CircleDot className="h-3 w-3" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </span>
              {!last && <span className="my-1 w-px flex-1 bg-border" />}
            </div>
            <div className={cn("min-w-0 pb-5", last && "pb-0")}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span
                  className={cn(
                    "text-[14px] font-semibold",
                    n.state === "reversed"
                      ? "text-muted-foreground line-through"
                      : "text-foreground",
                  )}
                >
                  {n.label}
                </span>
                {n.value != null && (
                  <span className="font-mono text-[12.5px] font-medium tabular-nums text-foreground">
                    {formatMoney(n.value)}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[12.5px] text-muted-foreground [overflow-wrap:anywhere]">
                {n.meta}
              </div>
              {n.reason && (
                <div className="mt-0.5 text-[12.5px] italic text-muted-foreground [overflow-wrap:anywhere]">
                  {n.reason}
                </div>
              )}
              {n.reversedNote && (
                <div className="mt-0.5 text-[12px] font-medium text-muted-foreground">
                  {n.reversedNote}
                </div>
              )}
              {n.notify && (
                <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-pill bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <Bell className="h-3 w-3" aria-hidden />
                  Notification sent to {n.notify}
                </span>
              )}
              {n.reverse && (
                <div className="mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive-ink"
                    onClick={() => onReverse(n.reverse!.issueId, n.reverse!.entryNo)}
                    data-testid="req-reverse"
                  >
                    Reverse issue
                  </Button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
