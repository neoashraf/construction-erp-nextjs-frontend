"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { Checkbox } from "@/components/ui/checkbox";
import { isInvalidLimit, normaliseLimit } from "../schemas/role-permissions";
import { type CreateRoleInput } from "../types";

/**
 * Create-custom-role dialog (spec §5/§6 · FR-AUD-034). Captures the new role's name
 * (required, unique — DUPLICATE_ROLE_NAME surfaced inline), `isUnscoped` mode, and
 * an optional `approvalLimit`; the grid starts empty (edited after creation). On
 * `201` the parent selects the new role.
 */
export function NewRoleDialog({
  open,
  submitting,
  nameError,
  onCancel,
  onCreate,
}: {
  open: boolean;
  submitting: boolean;
  /** Inline error under the name field (e.g. "A role with this name already exists."). */
  nameError: string | null;
  onCancel: () => void;
  onCreate: (input: CreateRoleInput) => void;
}) {
  const [name, setName] = useState("");
  const [isUnscoped, setIsUnscoped] = useState(false);
  const [approvalLimit, setApprovalLimit] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = name.trim();
  const nameEmpty = touched && trimmed === "";
  const limitInvalid = isInvalidLimit(approvalLimit);
  const canSubmit = trimmed !== "" && !limitInvalid && !submitting;

  function reset() {
    setName("");
    setIsUnscoped(false);
    setApprovalLimit("");
    setTouched(false);
  }

  function submit() {
    setTouched(true);
    if (trimmed === "" || limitInvalid) return;
    onCreate({ name: trimmed, isUnscoped, approvalLimit: normaliseLimit(approvalLimit) });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onCancel();
        }
      }}
    >
      <DialogContent data-testid="new-role-dialog">
        <DialogTitle>New role</DialogTitle>
        <DialogDescription className="mt-1">
          Create a custom role, then grant its permissions in the editor.
        </DialogDescription>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <Label htmlFor="new-role-name">Role name</Label>
            <Input
              id="new-role-name"
              value={name}
              autoFocus
              invalid={nameEmpty || !!nameError}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              data-testid="new-role-name"
              placeholder="e.g. Site Auditor"
            />
            {(nameEmpty || nameError) && (
              <p className="mt-1 text-[11.5px] text-destructive" data-testid="new-role-name-error">
                {nameError ?? "Enter a role name."}
              </p>
            )}
          </div>

          <label className="flex items-center gap-2.5">
            <Checkbox checked={isUnscoped} onChange={(e) => setIsUnscoped(e.target.checked)} data-testid="new-role-unscoped" />
            <span className="text-[13px] text-foreground">
              All-projects role{" "}
              <span className="text-muted-foreground">— applies org-wide (no per-project scope)</span>
            </span>
          </label>

          <div>
            <Label htmlFor="new-role-limit">Approval limit · optional</Label>
            <MoneyInput
              id="new-role-limit"
              value={approvalLimit}
              placeholder="No limit"
              invalid={limitInvalid}
              onChange={(e) => setApprovalLimit(e.target.value)}
              data-testid="new-role-limit"
            />
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              {limitInvalid ? "Enter an amount of 0 or more." : "Blank = no approval authority (every approval escalates)."}
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" size="md" onClick={onCancel} data-testid="new-role-cancel">
            Cancel
          </Button>
          <Button size="md" disabled={!canSubmit} onClick={submit} data-testid="new-role-create">
            {submitting ? "Creating…" : "Create role"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
