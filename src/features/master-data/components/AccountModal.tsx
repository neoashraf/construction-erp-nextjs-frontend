"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Info, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
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

type Mode = { kind: "create"; groupId?: string } | { kind: "edit"; account: Account };

/**
 * Account create/edit modal (FR-MAS-018/019/020/021, spec §7; design file
 * `Chart-of-Accounts.dc.html`). Centered pop-in dialog. The Group select auto-derives
 * the Type (FR-MAS-019). On edit, code is immutable and — if the account has postings —
 * the group is locked with the immutable note (FR-MAS-021). Opening balance is reference
 * data (৳, go-live note).
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
      : {
          code: "",
          name: "",
          accountGroupId: mode.kind === "create" ? (mode.groupId ?? "") : "",
          openingBalance: "",
        },
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[544px] p-0" data-testid="account-form">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col">
          {/* header */}
          <div className="border-b border-border px-[22px] pb-4 pt-5">
            <DialogTitle className="text-[17px] tracking-[-0.01em]">
              {isEdit ? `Edit ${editing?.code}` : "New account"}
            </DialogTitle>
            <DialogDescription className="mt-0.5 max-w-[46ch] text-[12.5px]">
              {isEdit
                ? "Update the account. Its type follows the group it belongs to."
                : "Pick a group and the account inherits its type. Code must be unique."}
            </DialogDescription>
          </div>

          {/* body */}
          <div className="flex flex-col gap-[18px] px-[22px] py-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-col gap-1.5 sm:w-[150px] sm:flex-none">
                <Label htmlFor="acc-code" className="text-[11px]">
                  Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="acc-code"
                  className="h-[38px] font-mono"
                  placeholder="e.g. 1060"
                  invalid={!!errors.code}
                  disabled={saving || isEdit}
                  {...register("code")}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Label htmlFor="acc-name" className="text-[11px]">
                  Account name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="acc-name"
                  className="h-[38px]"
                  placeholder="e.g. Petty cash — site office"
                  invalid={!!errors.name}
                  disabled={saving}
                  {...register("name")}
                />
              </div>
            </div>
            {errors.code && (
              <p className="-mt-2.5 text-[12px] text-destructive-ink" data-testid="code-error">
                {errors.code.message}
              </p>
            )}
            {errors.name && (
              <p className="-mt-2.5 text-[12px] text-destructive-ink">{errors.name.message}</p>
            )}
            {isEdit && !errors.code && (
              <p className="-mt-2.5 text-[12px] text-faint">Code can&apos;t change once created.</p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acc-group" className="text-[11px]">
                Account group <span className="text-destructive">*</span>
              </Label>
              <Select
                id="acc-group"
                className="h-[38px]"
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
                <p className="text-[12px] text-destructive-ink" data-testid="group-error">
                  {errors.accountGroupId.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                Type <span className="font-medium normal-case tracking-normal text-faint">· set by the group</span>
              </div>
              <div
                className="flex h-[38px] items-center gap-2.5 rounded-token border border-border bg-surface-2 px-3"
                data-testid="derived-type"
              >
                {derivedType ? (
                  <TypeBadge type={derivedType} />
                ) : (
                  <span className="text-[13px] text-faint">—</span>
                )}
                {locked && <Lock className="ml-auto h-3.5 w-3.5 text-faint" aria-hidden />}
              </div>
              {locked && (
                <p className="text-[12px] text-faint" data-testid="type-immutable-note">
                  This account has postings, so its type can&apos;t be changed.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acc-opening" className="text-[11px]">
                Opening balance{" "}
                <span className="font-medium normal-case tracking-normal text-faint">· optional</span>
              </Label>
              <MoneyInput
                id="acc-opening"
                className="h-[38px]"
                invalid={!!errors.openingBalance}
                disabled={saving}
                {...register("openingBalance")}
              />
              {errors.openingBalance && (
                <p className="text-[12px] text-destructive-ink">{errors.openingBalance.message}</p>
              )}
              <div className="flex gap-2 rounded-[9px] border border-border bg-surface-2 px-3 py-2.5">
                <Info className="mt-px h-3.5 w-3.5 flex-none text-info" aria-hidden />
                <span className="text-[12px] leading-relaxed text-muted-foreground">
                  Opening balances are reference values. They&apos;re posted once via the opening
                  journal at go-live.
                </span>
              </div>
            </div>
          </div>

          {/* footer */}
          <div className="flex justify-end gap-2.5 border-t border-border px-[22px] py-3.5">
            <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="md" disabled={saving} data-testid="account-save">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
