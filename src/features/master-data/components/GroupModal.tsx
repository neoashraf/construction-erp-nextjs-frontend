"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { asApiError } from "@/lib/api/errors";
import { type AccountGroup, ACCOUNT_TYPES } from "../types";
import {
  accountGroupSchema,
  type AccountGroupFormValues,
  ACCOUNT_TYPE_LABEL,
} from "../schemas/chart-of-accounts.schema";
import { useCreateAccountGroup, useUpdateAccountGroup } from "../hooks/useChartOfAccounts";

type Mode =
  | { kind: "create"; parentGroupId?: string }
  | { kind: "edit"; group: AccountGroup };

/**
 * Account-group create/edit modal (FR-MAS-017, spec §7; design file `Chart-of-Accounts.dc.html`).
 * Centered pop-in dialog. Type is set at creation (immutable after — PATCH doesn't accept it);
 * server type-vs-parent errors map to Type.
 */
export function GroupModal({
  mode,
  groups,
  onClose,
  onSuccess,
  onConflict,
  onError,
}: {
  mode: Mode;
  groups: AccountGroup[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onConflict: () => void;
  onError: (msg: string) => void;
}) {
  const isEdit = mode.kind === "edit";
  const editing = isEdit ? mode.group : null;
  const create = useCreateAccountGroup();
  const update = useUpdateAccountGroup();
  const saving = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AccountGroupFormValues>({
    resolver: zodResolver(accountGroupSchema),
    defaultValues: editing
      ? { name: editing.name, parentGroupId: editing.parentGroupId ?? "", type: editing.type }
      : { name: "", parentGroupId: mode.kind === "create" ? (mode.parentGroupId ?? "") : "", type: "ASSET" },
  });

  function mapError(err: unknown) {
    const e = asApiError(err);
    if (e.code === "OPTIMISTIC_LOCK_CONFLICT") return onConflict();
    if (e.code === "NETWORK_ERROR") return onError("You're offline. Try again when reconnected.");
    if (e.code === "FORBIDDEN") return onError("You don't have permission to do that.");
    if (e.code === "CROSS_COMPANY_REFERENCE")
      return onError("That parent group belongs to another company.");
    if (e.isValidation) {
      setError("type", { message: "Group type must be consistent with its parent." });
      return;
    }
    onError(e.message || "Couldn't save the group.");
  }

  function onSubmit(values: AccountGroupFormValues) {
    if (editing) {
      update.mutate(
        {
          id: editing.id,
          input: {
            name: values.name.trim(),
            parentGroupId: values.parentGroupId,
            version: editing.version,
          },
        },
        {
          onSuccess: () => {
            onSuccess("Group updated.");
            onClose();
          },
          onError: mapError,
        },
      );
    } else {
      create.mutate(
        { name: values.name.trim(), parentGroupId: values.parentGroupId, type: values.type },
        {
          onSuccess: () => {
            onSuccess("Group created.");
            onClose();
          },
          onError: mapError,
        },
      );
    }
  }

  const parentChoices = groups.filter((g) => g.id !== editing?.id);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[480px] p-0" data-testid="group-form">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col">
          {/* header */}
          <div className="border-b border-border px-[22px] pb-4 pt-5">
            <DialogTitle className="text-[17px] tracking-[-0.01em]">
              {isEdit ? `Edit ${editing?.name}` : "New account group"}
            </DialogTitle>
            <DialogDescription className="mt-0.5 max-w-[46ch] text-[12.5px]">
              {isEdit
                ? "Rename or re-parent the group. Its type is fixed after creation."
                : "Groups form the account-type hierarchy. Accounts inherit their group's type."}
            </DialogDescription>
          </div>

          {/* body */}
          <div className="flex flex-col gap-[18px] px-[22px] py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="grp-name" className="text-[11px]">
                Group name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="grp-name"
                className="h-[38px]"
                placeholder="e.g. Current Assets"
                invalid={!!errors.name}
                disabled={saving}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-[12px] text-destructive-ink">{errors.name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="grp-parent" className="text-[11px]">
                Parent group{" "}
                <span className="font-medium normal-case tracking-normal text-faint">· optional</span>
              </Label>
              <Select id="grp-parent" className="h-[38px]" disabled={saving} {...register("parentGroupId")}>
                <option value="">None (top-level)</option>
                {parentChoices.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({ACCOUNT_TYPE_LABEL[g.type]})
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="grp-type" className="text-[11px]">
                Type <span className="text-destructive">*</span>
              </Label>
              <Select
                id="grp-type"
                className="h-[38px]"
                invalid={!!errors.type}
                disabled={saving || isEdit}
                {...register("type")}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
              {isEdit ? (
                <p className="text-[12px] text-faint">A group&apos;s type is fixed after creation.</p>
              ) : errors.type ? (
                <p className="text-[12px] text-destructive-ink" data-testid="group-type-error">
                  {errors.type.message}
                </p>
              ) : null}
            </div>
          </div>

          {/* footer */}
          <div className="flex justify-end gap-2.5 border-t border-border px-[22px] py-3.5">
            <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="md" disabled={saving} data-testid="group-save">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
