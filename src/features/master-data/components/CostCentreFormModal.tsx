"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { asApiError } from "@/lib/api/errors";
import { type CostCentre } from "../types";
import { costCentreSchema, type CostCentreFormValues } from "../schemas/cost-centre.schema";
import { useCreateCostCentre, useRenameCostCentre } from "../hooks/useCostCentres";

type Mode = { kind: "create" } | { kind: "edit"; centre: CostCentre };

/** Add / rename cost-centre modal (FR-MAS-010, spec §7). Code immutable on rename. */
export function CostCentreFormModal({
  mode,
  onClose,
  onSuccess,
  onConflict,
  onError,
}: {
  mode: Mode;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onConflict: () => void;
  onError: (msg: string) => void;
}) {
  const isEdit = mode.kind === "edit";
  const editing = isEdit ? mode.centre : null;
  const create = useCreateCostCentre();
  const rename = useRenameCostCentre();
  const saving = create.isPending || rename.isPending;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CostCentreFormValues>({
    resolver: zodResolver(costCentreSchema),
    defaultValues: editing ? { code: editing.code, name: editing.name } : { code: "", name: "" },
  });

  function mapError(err: unknown) {
    const e = asApiError(err);
    if (e.code === "OPTIMISTIC_LOCK_CONFLICT") return onConflict();
    if (e.code === "NETWORK_ERROR") return onError("You're offline. Try again when reconnected.");
    if (e.code === "FORBIDDEN") return onError("You don't have permission to do that.");
    if (e.code === "DUPLICATE_CODE") {
      setError("code", { message: "This code is already used." });
      return;
    }
    if (e.isValidation && e.details) {
      const d = e.details as Record<string, string[] | string>;
      for (const f of ["code", "name"] as const) {
        const msg = Array.isArray(d[f]) ? (d[f] as string[])[0] : (d[f] as string | undefined);
        if (msg) setError(f, { message: String(msg) });
      }
      return;
    }
    onError(e.message || "Couldn't save the cost centre.");
  }

  function onSubmit(values: CostCentreFormValues) {
    if (editing) {
      rename.mutate(
        { id: editing.id, input: { name: values.name.trim(), version: editing.version } },
        {
          onSuccess: () => {
            onSuccess("Cost centre updated.");
            onClose();
          },
          onError: mapError,
        },
      );
    } else {
      create.mutate(
        { code: values.code.trim(), name: values.name.trim() },
        {
          onSuccess: () => {
            onSuccess("Cost centre created.");
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
          data-testid="cost-centre-form"
        >
          <SheetHeader
            kicker={isEdit ? "Rename" : "Create"}
            title={isEdit ? `Rename ${editing?.code}` : "New cost centre"}
          />
          <SheetBody className="flex flex-col gap-[18px]">
            <div>
              <Label htmlFor="cc-code" className="mb-1.5 block text-[10.5px]">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cc-code"
                className="font-mono"
                invalid={!!errors.code}
                disabled={saving || isEdit}
                {...register("code")}
              />
              {errors.code ? (
                <p
                  className="mt-1.5 text-[11.5px] text-destructive-ink"
                  data-testid="cc-code-error"
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
              <Label htmlFor="cc-name" className="mb-1.5 block text-[10.5px]">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="cc-name" invalid={!!errors.name} disabled={saving} {...register("name")} />
              {errors.name && (
                <p className="mt-1.5 text-[11.5px] text-destructive-ink">{errors.name.message}</p>
              )}
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="md" disabled={saving} data-testid="cost-centre-save">
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
