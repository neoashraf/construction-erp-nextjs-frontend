"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { asApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import {
  financialYearSchema,
  toApiDate,
  type FinancialYearFormValues,
} from "../schemas/financial-year.schema";
import { type FinancialYear } from "../types";
import { useCreateFinancialYear, useUpdateFinancialYear } from "../hooks/useFinancialYearMutations";

type Mode = { kind: "create" } | { kind: "edit"; fy: FinancialYear };

/**
 * Create/edit financial-year slide-over (FR-MAS-002, spec §7). Owns the form
 * (react-hook-form + zod), the create/update mutation, and server-error mapping:
 * `VALIDATION_ERROR` details → the offending field; `OPTIMISTIC_LOCK_CONFLICT` →
 * bubble to the screen (conflict toast + reload). Overlap is allowed — the note is
 * informational, never an error.
 */
export function FinancialYearFormModal({
  mode,
  onClose,
  onSuccess,
  onConflict,
  onError,
}: {
  mode: Mode;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onConflict: () => void;
  onError: (message: string) => void;
}) {
  const isEdit = mode.kind === "edit";
  const editing = isEdit ? mode.fy : null;

  const create = useCreateFinancialYear();
  const update = useUpdateFinancialYear();
  const saving = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FinancialYearFormValues>({
    resolver: zodResolver(financialYearSchema),
    defaultValues: editing
      ? {
          label: editing.label,
          startDate: formatDate(editing.startDate),
          endDate: formatDate(editing.endDate),
        }
      : { label: "", startDate: "", endDate: "" },
  });

  function mapServerError(err: unknown) {
    const e = asApiError(err);
    if (e.code === "OPTIMISTIC_LOCK_CONFLICT") {
      onConflict();
      return;
    }
    if (e.code === "NETWORK_ERROR") {
      onError("You're offline. Try again when reconnected.");
      return;
    }
    if (e.isValidation && e.details) {
      const d = e.details as Record<string, string[] | string>;
      let mapped = false;
      for (const field of ["label", "startDate", "endDate"] as const) {
        const msg = Array.isArray(d[field])
          ? (d[field] as string[])[0]
          : (d[field] as string | undefined);
        if (msg) {
          setError(field, { message: String(msg) });
          mapped = true;
        }
      }
      if (!mapped) {
        // Date-order failures the server reports without a field key land on endDate.
        setError("endDate", { message: "End date must be after the start date." });
      }
      return;
    }
    onError(e.message || "Couldn't save the financial year.");
  }

  function onSubmit(values: FinancialYearFormValues) {
    const payload = {
      label: values.label.trim(),
      startDate: toApiDate(values.startDate),
      endDate: toApiDate(values.endDate),
    };
    if (editing) {
      update.mutate(
        { id: editing.id, input: { ...payload, version: editing.version } },
        {
          onSuccess: () => {
            onSuccess("Financial year updated.");
            onClose();
          },
          onError: mapServerError,
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => {
          onSuccess("Financial year created.");
          onClose();
        },
        onError: mapServerError,
      });
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex h-full flex-col"
          data-testid="fy-form"
        >
          <SheetHeader
            kicker={isEdit ? "Edit financial year" : "Create"}
            title={isEdit ? `Edit ${editing?.label}` : "New financial year"}
          />

          <SheetBody className="flex flex-col gap-[18px]">
            {/* Label */}
            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="fy-label" className="text-[11px] tracking-[0.4px]">
                Label <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fy-label"
                className="h-[38px] font-mono"
                placeholder="e.g. 2025-26"
                invalid={!!errors.label}
                {...register("label")}
              />
              {errors.label ? (
                <span className="text-xs text-destructive-ink" data-testid="label-error">
                  {errors.label.message}
                </span>
              ) : (
                <span className="text-[11.5px] text-faint">
                  Bangla digits are fine (e.g. ২০২৫-২৬).
                </span>
              )}
            </div>

            {/* Dates */}
            <div className="flex gap-3.5">
              <div className="flex flex-1 flex-col gap-[7px]">
                <Label htmlFor="fy-start" className="text-[11px] tracking-[0.4px]">
                  Start date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fy-start"
                  className="h-[38px] font-mono"
                  placeholder="DD/MM/YYYY"
                  inputMode="numeric"
                  invalid={!!errors.startDate}
                  {...register("startDate")}
                />
                {errors.startDate ? (
                  <span className="text-xs text-destructive-ink" data-testid="start-error">
                    {errors.startDate.message}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-[7px]">
                <Label htmlFor="fy-end" className="text-[11px] tracking-[0.4px]">
                  End date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fy-end"
                  className="h-[38px] font-mono"
                  placeholder="DD/MM/YYYY"
                  inputMode="numeric"
                  invalid={!!errors.endDate}
                  {...register("endDate")}
                />
                {errors.endDate ? (
                  <span className="text-xs text-destructive-ink" data-testid="end-error">
                    {errors.endDate.message}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Overlap-allowed info note */}
            <Alert tone="info">
              Financial years may overlap. A new year isn&apos;t active until you set it active.
            </Alert>
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="md" disabled={saving} data-testid="fy-save">
              {saving && (
                <span
                  className="h-[14px] w-[14px] animate-spin rounded-full border-2 border-primary-foreground/45 border-t-primary-foreground"
                  aria-hidden
                />
              )}
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
