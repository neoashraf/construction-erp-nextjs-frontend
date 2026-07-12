"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type ApprovalAuthority } from "../schemas/requisition-approval.schema";

/**
 * The Approve / Reject decision bar (spec §4/§6/§9; FR-REQ-008/-010/-011). Enabled only when
 * the viewer's tier + scope authority allows — otherwise the buttons render **disabled** (not
 * hidden) with `aria-disabled` + the reason associated via `aria-describedby` (§10). Approve
 * is a single click; Reject opens the reason capture first. Both are server-confirmed — the
 * bar locks (spinner) while a decision is in flight so there's no double-submit (§6 saving).
 */

function helperFor(authority: ApprovalAuthority): string {
  if (authority.canDecide) {
    return "You were notified by SMS when this was submitted. Recording a decision notifies the Store Keeper and requester by SMS.";
  }
  switch (authority.reason) {
    case "escalated":
      return "Only the Accounts team can decide this requisition. You can view it and its history.";
    case "already-decided":
      return "A decision has already been recorded for this requisition — no further action is available.";
    default:
      return "You can view this requisition and its history. Only an authorised approver can decide it.";
  }
}

export function ApprovalActionBar({
  authority,
  busy,
  onApprove,
  onReject,
  showHelper = true,
  className,
}: {
  authority: ApprovalAuthority;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  showHelper?: boolean;
  className?: string;
}) {
  const helpId = useId();
  const canDecide = authority.canDecide;
  const disabled = !canDecide || busy;
  const helper = helperFor(authority);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      data-testid="req-action-bar"
    >
      {showHelper && (
        <p id={helpId} className="max-w-xl text-[12.5px] text-muted-foreground">
          {helper}
        </p>
      )}
      <div className="flex flex-none justify-end gap-2.5">
        <Button
          variant="outline"
          size="md"
          onClick={onReject}
          disabled={disabled}
          aria-disabled={disabled || undefined}
          aria-describedby={!canDecide ? helpId : undefined}
          className={cn(canDecide && "text-destructive-ink")}
          data-testid="req-reject"
        >
          Reject
        </Button>
        <Button
          size="md"
          onClick={onApprove}
          disabled={disabled}
          aria-disabled={disabled || undefined}
          aria-describedby={!canDecide ? helpId : undefined}
          aria-busy={busy || undefined}
          data-testid="req-approve"
        >
          {busy ? "Approving…" : "Approve"}
        </Button>
      </div>
    </div>
  );
}
