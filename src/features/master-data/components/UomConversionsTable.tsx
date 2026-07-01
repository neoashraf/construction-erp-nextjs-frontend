"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { asApiError } from "@/lib/api/errors";
import { parseMoney } from "@/lib/money";
import { useToast } from "@/components/ui/toast";
import { type ItemUomConversion } from "../types";
import { uomConversionSchema, type UomConversionFormValues } from "../schemas/item.schema";
import { useUomConversions, useUpsertConversion } from "../hooks/useUomConversions";
import { RemoveConversionDialog } from "./RemoveConversionDialog";

/**
 * UoM-conversions sub-table (FR-MAS-026, spec §7). Rows "1 <uom> = <factor> <base>";
 * add/edit via PUT upsert (re-adding a unit collapses to an edit, no dup error);
 * remove via a confirm dialog. Factor > 0 (Decimal, no float).
 */
export function UomConversionsTable({
  itemId,
  baseUom,
  canManage,
}: {
  itemId: string;
  baseUom: string;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const query = useUomConversions(itemId);
  const upsert = useUpsertConversion(itemId);
  const [removeTarget, setRemoveTarget] = useState<ItemUomConversion | null>(null);
  const conversions = query.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<UomConversionFormValues>({
    resolver: zodResolver(uomConversionSchema),
    defaultValues: { uom: "", factorToBase: "" },
  });

  function onSubmit(values: UomConversionFormValues) {
    upsert.mutate(
      { uom: values.uom.trim(), factorToBase: parseMoney(values.factorToBase).toFixed(4) },
      {
        onSuccess: () => {
          toast(`Conversion for ${values.uom.trim()} saved.`, "success");
          reset({ uom: "", factorToBase: "" });
        },
        onError: (err) => {
          const e = asApiError(err);
          if (e.isValidation)
            setError("factorToBase", { message: "Factor must be greater than 0." });
          else if (e.code === "NETWORK_ERROR")
            toast("You're offline. Try again when reconnected.", "error");
          else toast(e.message || "Couldn't save the conversion.", "error");
        },
      },
    );
  }

  function edit(c: ItemUomConversion) {
    setValue("uom", c.uom);
    setValue("factorToBase", c.factorToBase);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Unit conversions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {query.isLoading ? (
          <div className="flex flex-col gap-2" data-testid="conversions-loading">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <Alert tone="destructive" title="Couldn't load conversions.">
            <Button size="sm" onClick={() => query.refetch()} data-testid="conversions-retry">
              Retry
            </Button>
          </Alert>
        ) : conversions.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="conversions-empty">
            No alternate units. The base unit is <span className="font-semibold">{baseUom}</span>.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border" data-testid="conversions-list">
            {conversions.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between py-2"
                data-testid={`conversion-${c.id}`}
              >
                <span className="text-sm tabular-nums">
                  1 <span className="font-semibold">{c.uom}</span> = {c.factorToBase} {baseUom}
                </span>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => edit(c)}
                      className="text-xs font-semibold text-accent-ink hover:underline"
                      data-testid={`conversion-edit-${c.id}`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(c)}
                      aria-label={`Remove ${c.uom}`}
                      data-testid={`conversion-remove-${c.id}`}
                      className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground hover:bg-muted hover:text-destructive-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && !query.isError && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-wrap items-end gap-3 border-t border-border pt-4"
            data-testid="conversion-form"
          >
            <div className="w-28">
              <Label htmlFor="conv-uom" className="mb-1.5 block text-[10.5px]">
                Unit <span className="text-destructive">*</span>
              </Label>
              <Input
                id="conv-uom"
                invalid={!!errors.uom}
                disabled={upsert.isPending}
                {...register("uom")}
              />
            </div>
            <div className="w-36">
              <Label htmlFor="conv-factor" className="mb-1.5 block text-[10.5px]">
                Factor to {baseUom} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="conv-factor"
                inputMode="decimal"
                aria-describedby="conv-factor-hint"
                invalid={!!errors.factorToBase}
                disabled={upsert.isPending}
                {...register("factorToBase")}
              />
            </div>
            <Button
              type="submit"
              size="md"
              disabled={upsert.isPending}
              data-testid="conversion-save"
            >
              {upsert.isPending ? "Saving…" : "Add / update"}
            </Button>
            <p id="conv-factor-hint" className="w-full text-[11.5px] text-faint">
              1 unit = factor × base unit. Factor must be greater than 0.
            </p>
            {(errors.uom || errors.factorToBase) && (
              <p
                className="w-full text-[11.5px] text-destructive-ink"
                data-testid="conversion-error"
              >
                {errors.uom?.message ?? errors.factorToBase?.message}
              </p>
            )}
          </form>
        )}
      </CardContent>

      <RemoveConversionDialog
        itemId={itemId}
        conversion={removeTarget}
        baseUom={baseUom}
        onClose={() => setRemoveTarget(null)}
      />
    </Card>
  );
}
