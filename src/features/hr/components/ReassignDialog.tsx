"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerInput } from "@/components/ui/date-picker";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { asApiError } from "@/lib/api";
import { useMasterLookups } from "@/lib/masters/lookups";
import { useEmployeeMutations } from "../hooks/useEmployeeMutations";
import {
  emptyReassignForm,
  mapReassignError,
  reassignToInput,
  validateReassign,
  type ReassignFieldErrors,
  type ReassignFormValues,
} from "../schemas/employee.schema";
import { type Employee, type ProjectOption } from "../types";

/**
 * Reassign dialog (FR-HR-002; spec §7/§8). Small confirm-style dialog over the detail page.
 * On success the parent updates both the header default-project label and prepends the new
 * history row (via TanStack cache invalidation). `effectiveDate < joiningDate` is caught
 * client-side and echoed on the server (`400 VALIDATION_ERROR`) — either way the exact spec §8
 * copy surfaces inline.
 */
export function ReassignDialog({
  employee,
  open,
  onOpenChange,
  projectOptions,
}: {
  employee: Employee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectOptions?: ProjectOption[];
}) {
  const { toast } = useToast();
  const lookups = useMasterLookups();
  const { reassign } = useEmployeeMutations();
  const [form, setForm] = useState<ReassignFormValues>(emptyReassignForm);
  const [errors, setErrors] = useState<ReassignFieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(emptyReassignForm);
      setErrors({});
      setBanner(null);
    }
  }, [open]);

  // Options: either the caller passes them (list-scoped), or we synthesise a minimal set
  // by rendering the current default-project id — the server re-resolves any picked id and
  // rejects a cross-company one with `CROSS_COMPANY_REFERENCE`.
  const options: ProjectOption[] =
    projectOptions ??
    (employee.defaultProjectId
      ? [{ id: employee.defaultProjectId, name: lookups.project(employee.defaultProjectId) }]
      : []);

  function patch(p: Partial<ReassignFormValues>) {
    setBanner(null);
    setForm((prev) => ({ ...prev, ...p }));
    setErrors((prev) => {
      const copy = { ...prev };
      for (const k of Object.keys(p)) delete copy[k as keyof ReassignFormValues];
      return copy;
    });
  }

  async function onSubmit() {
    const res = validateReassign(form, employee.joiningDate);
    if (res.errors) {
      setErrors(res.errors);
      return;
    }
    setBusy(true);
    try {
      const updated = await reassign.mutateAsync({
        id: employee.id,
        input: reassignToInput(res.values, employee.version),
      });
      const projName = lookups.project(updated.defaultProjectId ?? "") || form.projectId;
      toast(`${employee.name} reassigned to ${projName}.`, "success");
      onOpenChange(false);
    } catch (err) {
      const e = asApiError(err);
      const mapped = mapReassignError(e.code);
      if (mapped.field) {
        setErrors((prev) => ({ ...prev, [mapped.field as keyof ReassignFormValues]: mapped.message }));
      }
      setBanner(mapped.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="reassign-dialog">
        <DialogTitle>Reassign {employee.name}</DialogTitle>
        <DialogDescription>
          This adds a new entry to the assignment history. The prior assignment is kept, never
          overwritten.
        </DialogDescription>

        {banner && (
          <Alert tone="destructive" className="mt-3" title={banner} data-testid="reassign-banner" />
        )}

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reassign-project"
              className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            >
              New project <span className="text-destructive">*</span>
            </label>
            <Select
              id="reassign-project"
              value={form.projectId}
              onChange={(e) => patch({ projectId: e.target.value })}
              invalid={!!errors.projectId}
              disabled={busy}
              data-testid="reassign-project"
            >
              <option value="">Select…</option>
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {errors.projectId && (
              <p className="text-[12px] font-medium text-destructive" data-testid="reassign-project-err">
                {errors.projectId}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reassign-date"
              className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            >
              Effective date <span className="text-destructive">*</span>
            </label>
            <DatePickerInput
              id="reassign-date"
              value={form.effectiveDate}
              onChange={(v) => patch({ effectiveDate: v })}
              invalid={!!errors.effectiveDate}
              disabled={busy}
              data-testid="reassign-date"
            />
            {errors.effectiveDate && (
              <p className="text-[12px] font-medium text-destructive" data-testid="reassign-date-err">
                {errors.effectiveDate}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reassign-note"
              className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            >
              Note
            </label>
            <Textarea
              id="reassign-note"
              rows={3}
              value={form.note}
              onChange={(e) => patch({ note: e.target.value })}
              disabled={busy}
              data-testid="reassign-note"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={busy} data-testid="reassign-confirm">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Reassign
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
