"use client";

import Link from "next/link";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { roleNameLabel, type RoleListItem } from "../types";
import { roleInUseMessage } from "../schemas/role-permissions";

/**
 * Delete-custom-role confirm (spec §6/§8/§13 · FR-AUD-034). A role held by ≥ 1 user
 * can't be deleted (ROLE_IN_USE) — the dialog explains and links to the filtered
 * user list instead of offering Delete. Otherwise the exact §8 confirm copy.
 */
export function DeleteRoleDialog({
  role,
  submitting,
  onCancel,
  onConfirm,
}: {
  role: RoleListItem | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!role) return null;
  const label = roleNameLabel(role.name);
  const inUse = role.userCount > 0;

  return (
    <Dialog open={!!role} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent hideClose data-testid="delete-role-dialog">
        {inUse ? (
          <>
            <DialogTitle>Can’t delete this role</DialogTitle>
            <DialogDescription className="mt-2" data-testid="delete-role-inuse">
              {roleInUseMessage(role.userCount)}
            </DialogDescription>
            <div className="mt-5 flex justify-end gap-2.5">
              <Button variant="outline" size="md" onClick={onCancel} data-testid="delete-role-cancel">
                Cancel
              </Button>
              <Button asChild size="md" data-testid="delete-role-reassign">
                <Link href={`/audit/users?role=${role.id}`}>Reassign users</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogTitle>Delete this role?</DialogTitle>
            <DialogDescription className="mt-2">
              This custom role and its permissions will be removed. This can’t be undone.
            </DialogDescription>
            <p className="mt-1 text-[12.5px] font-medium text-foreground">{label}</p>
            <div className="mt-5 flex justify-end gap-2.5">
              <Button variant="outline" size="md" onClick={onCancel} data-testid="delete-role-cancel">
                Cancel
              </Button>
              <Button variant="destructive" size="md" disabled={submitting} onClick={onConfirm} data-testid="delete-role-confirm">
                {submitting ? "Deleting…" : "Delete role"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
