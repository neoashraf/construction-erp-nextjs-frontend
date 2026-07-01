"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { asApiError } from "@/lib/api/errors";
import { type Item, type Account } from "../types";
import { itemSchema, type ItemFormValues } from "../schemas/item.schema";
import { useCreateItem, useUpdateItem } from "../hooks/useItems";
import { AccountPicker } from "./AccountPicker";

type Mode = { kind: "create" } | { kind: "edit"; item: Item };

/**
 * Item create/edit form (FR-MAS-025/027/034, spec §7). Code immutable on edit; the
 * Base UoM locks (read-only + note) once the item has conversions/transactions.
 * Default GL account is picked from ACTIVE accounts only.
 */
export function ItemDetailForm({
  mode,
  accounts,
  baseUomLocked,
  readOnly = false,
  onCreated,
  onUpdated,
  onCancel,
  onReload,
  onError,
}: {
  mode: Mode;
  accounts: Account[];
  baseUomLocked: boolean;
  readOnly?: boolean;
  onCreated: (id: string) => void;
  onUpdated: () => void;
  onCancel: () => void;
  onReload: () => void;
  onError: (msg: string) => void;
}) {
  const isEdit = mode.kind === "edit";
  const editing = isEdit ? mode.item : null;
  const create = useCreateItem();
  const update = useUpdateItem();
  const saving = create.isPending || update.isPending;
  const disabled = saving || readOnly;

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
    if (e.code === "OPTIMISTIC_LOCK_CONFLICT") {
      onError("This item was changed by someone else. Reload and try again.");
      onReload();
      return;
    }
    if (e.code === "NETWORK_ERROR") return onError("You're offline. Try again when reconnected.");
    if (e.code === "FORBIDDEN") return onError("You don't have permission to do that.");
    if (e.code === "BASE_UOM_IMMUTABLE") {
      onError("This item has conversions or transactions, so its base unit can't be changed.");
      onReload();
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
            onUpdated();
          },
          onError: mapError,
        },
      );
    } else {
      create.mutate(
        { code: values.code.trim(), ...payload },
        { onSuccess: (res) => onCreated(res.id), onError: mapError },
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Item details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate data-testid="item-form">
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="item-code" className="mb-1.5 block text-[10.5px]">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-code"
                className="font-mono"
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
            <div>
              <Label htmlFor="item-name" className="mb-1.5 block text-[10.5px]">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-name"
                invalid={!!errors.name}
                disabled={disabled}
                {...register("name")}
              />
              {errors.name && (
                <p className="mt-1.5 text-[11.5px] text-destructive-ink">{errors.name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="item-base" className="mb-1.5 block text-[10.5px]">
                Base unit <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-base"
                invalid={!!errors.baseUom}
                disabled={disabled || baseUomLocked}
                {...register("baseUom")}
              />
              {errors.baseUom ? (
                <p className="mt-1.5 text-[11.5px] text-destructive-ink">
                  {errors.baseUom.message}
                </p>
              ) : baseUomLocked ? (
                <p className="mt-1.5 text-[11.5px] text-faint" data-testid="base-uom-locked-note">
                  The base unit is fixed once conversions or transactions exist.
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="item-hs" className="mb-1.5 block text-[10.5px]">
                H.S. Code
              </Label>
              <Input
                id="item-hs"
                className="font-mono"
                disabled={disabled}
                {...register("hsCode")}
              />
            </div>
            <div className="sm:col-span-2">
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
              {errors.defaultAccountId && (
                <p
                  className="mt-1.5 text-[11.5px] text-destructive-ink"
                  data-testid="item-account-error"
                >
                  {errors.defaultAccountId.message}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2.5">
            <Button type="button" variant="ghost" size="md" onClick={onCancel} disabled={saving}>
              {readOnly ? "Back to items" : "Cancel"}
            </Button>
            {!readOnly && (
              <Button type="submit" size="md" disabled={disabled} data-testid="item-save">
                {saving ? "Saving…" : isEdit ? "Save changes" : "Create item"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
