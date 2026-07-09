"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { asApiError } from "@/lib/api/errors";
import { type Purpose } from "../types";
import { purposeSchema, type PurposeFormValues } from "../schemas/purpose.schema";
import { useCreatePurpose, useRenamePurpose } from "../hooks/usePurposes";

type Mode = { kind: "create" } | { kind: "edit"; purpose: Purpose };

/**
 * Add / rename purpose modal (FR-MAS-011/013, spec §7; design file `Purposes.dc.html`).
 * Centered pop-in dialog (460px): title + subtitle · Name field with help/error · Cancel
 * + Save. Case-insensitive unique per project.
 */
export function PurposeFormModal({
  mode,
  projectId,
  projectName,
  onClose,
  onSuccess,
  onConflict,
  onError,
}: {
  mode: Mode;
  projectId: string;
  /** Shown in the subtitle + help text ("Scoped to {projectName}…"); omitted → generic. */
  projectName?: string;
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

  const scope = projectName ?? "this project";

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[460px] p-0" data-testid="purpose-form">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col">
          {/* header */}
          <div className="border-b border-border px-[22px] pb-4 pt-5">
            <DialogTitle className="text-[17px] tracking-[-0.01em]">
              {isEdit ? "Rename purpose" : "New purpose"}
            </DialogTitle>
            <DialogDescription className="mt-0.5 max-w-[44ch] text-[12.5px]">
              {isEdit
                ? "The name updates everywhere it appears on this project."
                : `Scoped to ${scope}. Reusable in this project's voucher pickers.`}
            </DialogDescription>
          </div>

          {/* body */}
          <div className="px-[22px] py-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purpose-name" className="text-[11px]">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="purpose-name"
                className="h-[38px]"
                placeholder="e.g. Material Purchase · মালামাল ক্রয়"
                invalid={!!errors.name}
                disabled={saving}
                {...register("name")}
              />
              {errors.name ? (
                <p className="text-[12px] text-destructive-ink" data-testid="purpose-name-error">
                  {errors.name.message}
                </p>
              ) : (
                <p className="text-[11.5px] text-faint">
                  Unique within {scope} (case-insensitive). Bangla is fine.
                </p>
              )}
            </div>
          </div>

          {/* footer */}
          <div className="flex justify-end gap-2.5 border-t border-border px-[22px] py-3.5">
            <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="md" disabled={saving} data-testid="purpose-save">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
