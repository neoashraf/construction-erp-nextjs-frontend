"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { Alert } from "@/components/ui/alert";
import { asApiError } from "@/lib/api/errors";
import { parseMoney } from "@/lib/money";
import { type Account, type AccountGroup } from "../types";
import {
  accountSchema,
  type AccountFormValues,
  ACCOUNT_TYPE_LABEL,
} from "../schemas/chart-of-accounts.schema";
import { useCreateAccount, useUpdateAccount } from "../hooks/useChartOfAccounts";
import { TypeBadge } from "./TypeBadge";

type Mode = { kind: "create" } | { kind: "edit"; account: Account };

/**
 * Account create/edit modal (FR-MAS-018/019/020/021, spec §7). The Group select
 * auto-derives the Type (FR-MAS-019). On edit, code is immutable and — if the
 * account has postings — the group is locked with the immutable note (FR-MAS-021).
 * Opening balance is reference data (৳, go-live note).
 */
export function AccountModal({
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
  const editing = isEdit ? mode.account : null;
  const locked = !!editing?.hasPostings;
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const saving = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: editing
      ? {
          code: editing.code,
          name: editing.name,
          accountGroupId: editing.accountGroupId,
          openingBalance: editing.openingBalance ?? "",
        }
      : { code: "", name: "", accountGroupId: "", openingBalance: "" },
  });

  const watchedGroupId = watch("accountGroupId");
  const derivedType = groups.find((g) => g.id === watchedGroupId)?.type ?? editing?.type;

  function mapError(err: unknown) {
    const e = asApiError(err);
    if (e.code === "OPTIMISTIC_LOCK_CONFLICT") return onConflict();
    if (e.code === "NETWORK_ERROR") return onError("You're offline. Try again when reconnected.");
    if (e.code === "FORBIDDEN") return onError("You don't have permission to do that.");
    if (e.code === "DUPLICATE_CODE") {
      setError("code", { message: "This account code is already used." });
      return;
    }
    if (e.code === "ACCOUNT_TYPE_MISMATCH") {
      setError("accountGroupId", { message: "Account type must match its group's type." });
      return;
    }
    if (e.code === "ACCOUNT_TYPE_IMMUTABLE") {
      setError("accountGroupId", {
        message: "This account has postings, so its type can't be changed.",
      });
      return;
    }
    if (e.code === "CROSS_COMPANY_REFERENCE")
      return onError("That group belongs to another company.");
    if (e.isValidation && e.details) {
      const d = e.details as Record<string, string[] | string>;
      for (const f of ["code", "name", "accountGroupId", "openingBalance"] as const) {
        const msg = Array.isArray(d[f]) ? (d[f] as string[])[0] : (d[f] as string | undefined);
        if (msg) setError(f, { message: String(msg) });
      }
      return;
    }
    onError(e.message || "Couldn't save the account.");
  }

  function onSubmit(values: AccountFormValues) {
    const type = groups.find((g) => g.id === values.accountGroupId)?.type ?? editing?.type;
    if (!type) {
      setError("accountGroupId", { message: "Select a group." });
      return;
    }
    const openingBalance =
      values.openingBalance === "" ? null : parseMoney(values.openingBalance).toFixed(4);

    if (editing) {
      update.mutate(
        {
          id: editing.id,
          input: {
            name: values.name.trim(),
            accountGroupId: values.accountGroupId,
            type,
            openingBalance,
            version: editing.version,
          },
        },
        {
          onSuccess: () => {
            onSuccess("Account updated.");
            onClose();
          },
          onError: mapError,
        },
      );
    } else {
      create.mutate(
        {
          code: values.code.trim(),
          name: values.name.trim(),
          accountGroupId: values.accountGroupId,
          type,
          openingBalance,
        },
        {
          onSuccess: () => {
            onSuccess("Account created.");
            onClose();
          },
          onError: mapError,
        },
      );
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex h-full flex-col"
          data-testid="account-form"
        >
          <SheetHeader
            kicker={isEdit ? "Edit account" : "Create"}
            title={isEdit ? `Edit ${editing?.code}` : "New account"}
          />
          <SheetBody className="flex flex-col gap-[18px]">
            <div className="grid grid-cols-2 gap-x-4 gap-y-[18px]">
              <div>
                <Label htmlFor="acc-code" className="mb-1.5 block text-[10.5px]">
                  Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="acc-code"
                  className="font-mono"
                  invalid={!!errors.code}
                  disabled={saving || isEdit}
                  {...register("code")}
                />
                {errors.code ? (
                  <p className="mt-1.5 text-[11.5px] text-destructive-ink" data-testid="code-error">
                    {errors.code.message}
                  </p>
                ) : isEdit ? (
                  <p className="mt-1.5 text-[11.5px] text-faint">
                    Code can&apos;t change once created.
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="acc-name" className="mb-1.5 block text-[10.5px]">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="acc-name"
                  invalid={!!errors.name}
                  disabled={saving}
                  {...register("name")}
                />
                {errors.name && (
                  <p className="mt-1.5 text-[11.5px] text-destructive-ink">{errors.name.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="acc-group" className="mb-1.5 block text-[10.5px]">
                Group <span className="text-destructive">*</span>
              </Label>
              <Select
                id="acc-group"
                invalid={!!errors.accountGroupId}
                disabled={saving || locked}
                {...register("accountGroupId")}
              >
                <option value="">Select a group…</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({ACCOUNT_TYPE_LABEL[g.type]})
                  </option>
                ))}
              </Select>
              {errors.accountGroupId && (
                <p className="mt-1.5 text-[11.5px] text-destructive-ink" data-testid="group-error">
                  {errors.accountGroupId.message}
                </p>
              )}
            </div>

            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                Type <span className="font-medium normal-case text-faint">· set by the group</span>
              </div>
              <div className="flex h-9 items-center" data-testid="derived-type">
                {derivedType ? (
                  <TypeBadge type={derivedType} />
                ) : (
                  <span className="text-sm text-faint">—</span>
                )}
              </div>
              {locked && (
                <p className="mt-1 text-[11.5px] text-faint" data-testid="type-immutable-note">
                  This account has postings, so its type can&apos;t be changed.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="acc-opening" className="mb-1.5 block text-[10.5px]">
                Opening balance
              </Label>
              <MoneyInput
                id="acc-opening"
                invalid={!!errors.openingBalance}
                disabled={saving}
                {...register("openingBalance")}
              />
              {errors.openingBalance && (
                <p className="mt-1.5 text-[11.5px] text-destructive-ink">
                  {errors.openingBalance.message}
                </p>
              )}
            </div>

            <Alert tone="info">
              Opening balance is reference data. It&apos;s posted via the opening journal at
              go-live, never from this screen.
            </Alert>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="md" disabled={saving} data-testid="account-save">
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
