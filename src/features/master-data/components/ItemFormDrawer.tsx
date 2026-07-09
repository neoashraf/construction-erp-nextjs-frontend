"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { asApiError } from "@/lib/api/errors";
import { type Item, type Account } from "../types";
import { itemSchema, type ItemFormValues } from "../schemas/item.schema";
import { useCreateItem, useUpdateItem } from "../hooks/useItems";
import { useUomConversions } from "../hooks/useUomConversions";
import { useAccounts } from "../hooks/useChartOfAccounts";
import { AccountPicker } from "./AccountPicker";
import { UomConversionsTable } from "./UomConversionsTable";

type Mode = { kind: "create" } | { kind: "edit"; item: Item };

/**
 * Item create/edit slide-over drawer (FR-MAS-025/026/027/034, spec §7; Items.dc.html).
 * Right-side Sheet replacing the old dedicated /new · /[id] routes. Code is immutable on
 * edit; the Base UoM locks (read-only + note) once conversions/transactions exist. The
 * unit-conversions sub-table only shows on edit — a created item has no id to attach to yet.
 */
export function ItemFormDrawer({
  mode,
  canManage,
  onClose,
  onSuccess,
  onConflict,
  onError,
}: {
  mode: Mode;
  canManage: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onConflict: () => void;
  onError: (msg: string) => void;
}) {
  const isEdit = mode.kind === "edit";
  const editing = isEdit ? mode.item : null;

  const accountsQuery = useAccounts();
  const accounts: Account[] = accountsQuery.data ?? [];
  const conversionsQuery = useUomConversions(editing ? editing.id : null);
  const baseUomLocked =
    (conversionsQuery.data?.length ?? 0) > 0 || !!editing?.hasTransactions;

  const create = useCreateItem();
  const update = useUpdateItem();
  const saving = create.isPending || update.isPending;
  const disabled = saving || !canManage;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: editing
      ? {
          code: editing.code,
          name: editing.name,
          baseUom: editing.baseUom,
          hsCode: editing.hsCode ?? "",
          defaultAccountId: editing.defaultAccountId ?? "",
        }
      : { code: "", name: "", baseUom: "", hsCode: "", defaultAccountId: "" },
  });

  function mapError(err: unknown) {
    const e = asApiError(err);
    if (e.code === "OPTIMISTIC_LOCK_CONFLICT") return onConflict();
    if (e.code === "NETWORK_ERROR") return onError("You're offline. Try again when reconnected.");
    if (e.code === "FORBIDDEN") return onError("You don't have permission to do that.");
    if (e.code === "BASE_UOM_IMMUTABLE") {
      onError("This item has conversions or transactions, so its base unit can't be changed.");
      return;
    }
    if (e.code === "DUPLICATE_CODE") {
      setError("code", { message: "This item code is already used." });
      return;
    }
    if (e.code === "CROSS_COMPANY_REFERENCE") {
      setError("defaultAccountId", { message: "Default account must belong to this company." });
      return;
    }
    if (e.isValidation && e.details) {
      const d = e.details as Record<string, string[] | string>;
      for (const f of ["code", "name", "baseUom", "hsCode", "defaultAccountId"] as const) {
        const msg = Array.isArray(d[f]) ? (d[f] as string[])[0] : (d[f] as string | undefined);
        if (msg) setError(f, { message: String(msg) });
      }
      return;
    }
    onError(e.message || "Couldn't save the item.");
  }

  function onSubmit(values: ItemFormValues) {
    const payload = {
      name: values.name.trim(),
      baseUom: values.baseUom.trim(),
      hsCode: values.hsCode || null,
      defaultAccountId: values.defaultAccountId,
    };
    if (editing) {
      update.mutate(
        { id: editing.id, input: { ...payload, version: editing.version } },
        {
          onSuccess: () => {
            onSuccess("Item updated.");
            onClose();
          },
          onError: mapError,
        },
      );
    } else {
      create.mutate(
        { code: values.code.trim(), ...payload },
        {
          onSuccess: () => {
            onSuccess("Item created.");
            onClose();
          },
          onError: mapError,
        },
      );
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[512px]">
        <SheetHeader
          kicker={isEdit ? "Edit" : "Create"}
          title={isEdit ? "Edit item" : "New item"}
        />
        <SheetBody className="flex flex-col gap-[18px]">
          <form
            id="item-drawer-form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-[18px]"
            data-testid="item-form"
          >
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="sm:w-[190px] sm:flex-none">
                <Label htmlFor="item-code" className="mb-1.5 block text-[10.5px]">
                  Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="item-code"
                  className="font-mono"
                  placeholder="e.g. CEM-OPC-50"
                  invalid={!!errors.code}
                  disabled={disabled || isEdit}
                  {...register("code")}
                />
                {errors.code ? (
                  <p
                    className="mt-1.5 text-[11.5px] text-destructive-ink"
                    data-testid="item-code-error"
                  >
                    {errors.code.message}
                  </p>
                ) : isEdit ? (
                  <p className="mt-1.5 text-[11.5px] text-faint">
                    Code can&apos;t change once created.
                  </p>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <Label htmlFor="item-name" className="mb-1.5 block text-[10.5px]">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="item-name"
                  placeholder="Item name"
                  invalid={!!errors.name}
                  disabled={disabled}
                  {...register("name")}
                />
                {errors.name && (
                  <p className="mt-1.5 text-[11.5px] text-destructive-ink">{errors.name.message}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="sm:w-[190px] sm:flex-none">
                <Label htmlFor="item-base" className="mb-1.5 block text-[10.5px]">
                  Base UoM <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="item-base"
                  placeholder="bag, kg, cft…"
                  invalid={!!errors.baseUom}
                  disabled={disabled || baseUomLocked}
                  {...register("baseUom")}
                />
                {errors.baseUom && (
                  <p className="mt-1.5 text-[11.5px] text-destructive-ink">
                    {errors.baseUom.message}
                  </p>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Label htmlFor="item-hs" className="mb-1.5 block text-[10.5px]">
                  H.S. Code
                </Label>
                <Input
                  id="item-hs"
                  className="font-mono"
                  placeholder="Bangladesh H.S. Code"
                  disabled={disabled}
                  {...register("hsCode")}
                />
              </div>
            </div>

            {baseUomLocked && (
              <div
                className="flex gap-2.5 rounded-token border border-border bg-surface-2 px-3 py-2.5"
                data-testid="base-uom-locked-note"
              >
                <span aria-hidden className="mt-px flex-none text-faint">
                  🔒
                </span>
                <span className="text-[11.5px] leading-relaxed text-muted-foreground">
                  The base unit is fixed once conversions or stock exist, because conversion
                  factors are defined against it.
                </span>
              </div>
            )}

            <div>
              <Label htmlFor="item-account" className="mb-1.5 block text-[10.5px]">
                Default GL account <span className="text-destructive">*</span>
              </Label>
              <AccountPicker
                id="item-account"
                accounts={accounts}
                invalid={!!errors.defaultAccountId}
                disabled={disabled}
                {...register("defaultAccountId")}
              />
              {errors.defaultAccountId ? (
                <p
                  className="mt-1.5 text-[11.5px] text-destructive-ink"
                  data-testid="item-account-error"
                >
                  {errors.defaultAccountId.message}
                </p>
              ) : (
                <p className="mt-1.5 text-[11.5px] text-faint">
                  Posting default for purchase and consumption of this item.
                </p>
              )}
            </div>
          </form>

          {isEdit && editing && (
            <div className="border-t border-border pt-[18px]">
              <UomConversionsTable
                itemId={editing.id}
                baseUom={editing.baseUom}
                canManage={canManage}
              />
            </div>
          )}
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {canManage && (
            <Button
              type="submit"
              form="item-drawer-form"
              size="md"
              disabled={disabled}
              data-testid="item-save"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
