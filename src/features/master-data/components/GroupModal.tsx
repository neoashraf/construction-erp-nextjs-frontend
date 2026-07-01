"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet";
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

type Mode = { kind: "create" } | { kind: "edit"; group: AccountGroup };

/** Account-group create/edit modal (FR-MAS-017, spec §7). Type is set at creation
 *  (immutable after — PATCH doesn't accept it); server type-vs-parent errors map to Type. */
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
      : { name: "", parentGroupId: "", type: "ASSET" },
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
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex h-full flex-col"
          data-testid="group-form"
        >
          <SheetHeader
            kicker={isEdit ? "Edit group" : "Create"}
            title={isEdit ? `Edit ${editing?.name}` : "New account group"}
          />
          <SheetBody className="flex flex-col gap-[18px]">
            <div>
              <Label htmlFor="grp-name" className="mb-1.5 block text-[10.5px]">
                Group name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="grp-name"
                invalid={!!errors.name}
                disabled={saving}
                {...register("name")}
              />
              {errors.name && (
                <p className="mt-1.5 text-[11.5px] text-destructive-ink">{errors.name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="grp-parent" className="mb-1.5 block text-[10.5px]">
                Parent group
              </Label>
              <Select id="grp-parent" disabled={saving} {...register("parentGroupId")}>
                <option value="">None (top-level)</option>
                {parentChoices.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({ACCOUNT_TYPE_LABEL[g.type]})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="grp-type" className="mb-1.5 block text-[10.5px]">
                Type <span className="text-destructive">*</span>
              </Label>
              <Select
                id="grp-type"
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
                <p className="mt-1.5 text-[11.5px] text-faint">
                  A group&apos;s type is fixed after creation.
                </p>
              ) : errors.type ? (
                <p
                  className="mt-1.5 text-[11.5px] text-destructive-ink"
                  data-testid="group-type-error"
                >
                  {errors.type.message}
                </p>
              ) : null}
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="md" disabled={saving} data-testid="group-save">
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
