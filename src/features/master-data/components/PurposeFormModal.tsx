"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { asApiError } from "@/lib/api/errors";
import { type Purpose } from "../types";
import { purposeSchema, type PurposeFormValues } from "../schemas/purpose.schema";
import { useCreatePurpose, useRenamePurpose } from "../hooks/usePurposes";

type Mode = { kind: "create" } | { kind: "edit"; purpose: Purpose };

/** Add / rename purpose modal (FR-MAS-011/013, spec §7). Case-insensitive unique per project. */
export function PurposeFormModal({
  mode,
  projectId,
  onClose,
  onSuccess,
  onConflict,
  onError,
}: {
  mode: Mode;
  projectId: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onConflict: () => void;
  onError: (msg: string) => void;
}) {
  const isEdit = mode.kind === "edit";
  const editing = isEdit ? mode.purpose : null;
  const create = useCreatePurpose();
  const rename = useRenamePurpose();
  const saving = create.isPending || rename.isPending;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PurposeFormValues>({
    resolver: zodResolver(purposeSchema),
    defaultValues: editing ? { name: editing.name } : { name: "" },
  });

  function mapError(err: unknown) {
    const e = asApiError(err);
    if (e.code === "OPTIMISTIC_LOCK_CONFLICT") return onConflict();
    if (e.code === "NETWORK_ERROR") return onError("You're offline. Try again when reconnected.");
    if (e.code === "FORBIDDEN") return onError("You don't have permission to do that.");
    if (e.code === "DUPLICATE_NAME") {
      setError("name", { message: "A purpose with this name already exists for this project." });
      return;
    }
    if (e.isValidation && e.details) {
      const d = e.details as Record<string, string[] | string>;
      const msg = Array.isArray(d.name) ? d.name[0] : (d.name as string | undefined);
      if (msg) setError("name", { message: String(msg) });
      return;
    }
    onError(e.message || "Couldn't save the purpose.");
  }

  function onSubmit(values: PurposeFormValues) {
    if (editing) {
      rename.mutate(
        {
          projectId,
          id: editing.id,
          input: { name: values.name.trim(), version: editing.version },
        },
        {
          onSuccess: () => {
            onSuccess("Purpose updated.");
            onClose();
          },
          onError: mapError,
        },
      );
    } else {
      create.mutate(
        { projectId, name: values.name.trim() },
        {
          onSuccess: () => {
            onSuccess("Purpose created.");
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
          data-testid="purpose-form"
        >
          <SheetHeader
            kicker={isEdit ? "Rename" : "Create"}
            title={isEdit ? `Rename purpose` : "New purpose"}
          />
          <SheetBody className="flex flex-col gap-[18px]">
            <div>
              <Label htmlFor="purpose-name" className="mb-1.5 block text-[10.5px]">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="purpose-name"
                invalid={!!errors.name}
                disabled={saving}
                {...register("name")}
              />
              {errors.name && (
                <p
                  className="mt-1.5 text-[11.5px] text-destructive-ink"
                  data-testid="purpose-name-error"
                >
                  {errors.name.message}
                </p>
              )}
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="md" disabled={saving} data-testid="purpose-save">
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
