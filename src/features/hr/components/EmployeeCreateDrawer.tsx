"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { asApiError } from "@/lib/api";
import { useOnline } from "@/lib/hooks/use-online";
import { useEmployeeMutations } from "../hooks/useEmployeeMutations";
import { useProjectOptions } from "../hooks/useProjectOptions";
import { EmployeeProfileForm } from "./EmployeeProfileForm";
import {
  emptyEmployeeForm,
  formToCreateInput,
  mapEmployeeError,
  validateEmployee,
  type EmployeeFieldErrors,
  type EmployeeFormValues,
} from "../schemas/employee.schema";

interface ProjectRef {
  id: string;
  projectCode: string;
  name: string;
}

/**
 * Right-side slide-over "New employee" drawer (spec §3/§9). The Sheet primitive handles the
 * focus trap, Esc/scrim close, focus restore. On save success the drawer closes and the
 * parent navigates to the new employee's detail page (`/hr/employees/{id}`). Cancel / Esc /
 * scrim while dirty prompts a small confirm (Radix Dialog nested inside the sheet). Offline
 * shows an inline banner and disables Save (spec §6). Server errors map to their exact §8
 * copy via `mapEmployeeError`.
 */
export function EmployeeCreateDrawer({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const online = useOnline();
  const [form, setForm] = useState<EmployeeFormValues>(emptyEmployeeForm);
  const [errors, setErrors] = useState<EmployeeFieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const { create } = useEmployeeMutations();

  // Project options via a thin HR-local `/masters/projects` binding (import-boundary rule:
  // `features/hr` can't import `features/master-data`). Falls back to an empty list on
  // failure — the user can still save with "— Unassigned —" and the server re-resolves,
  // rejecting a cross-company id as `CROSS_COMPANY_REFERENCE`.
  const projectQuery = useProjectOptions();
  const projectOptions = useMemo<ProjectRef[]>(
    () => (projectQuery.data ?? []).map((p) => ({ id: p.id, projectCode: "", name: p.name })),
    [projectQuery.data],
  );

  const isDirty =
    form.employeeCode !== "" ||
    form.name !== "" ||
    form.designation !== "" ||
    form.wageAmount !== "" ||
    form.joiningDate !== "" ||
    form.tin !== "" ||
    form.department !== "";

  function patch(p: Partial<EmployeeFormValues>) {
    setBanner(null);
    setForm((prev) => ({ ...prev, ...p }));
    setErrors((prev) => {
      const copy = { ...prev };
      for (const k of Object.keys(p)) delete copy[k as keyof EmployeeFormValues];
      return copy;
    });
  }

  function requestClose() {
    if (busy) return;
    if (isDirty) {
      setDiscardOpen(true);
      return;
    }
    resetAndClose();
  }

  function resetAndClose() {
    setForm(emptyEmployeeForm);
    setErrors({});
    setBanner(null);
    setDiscardOpen(false);
    onOpenChange(false);
  }

  async function onSubmit() {
    setBanner(null);
    const res = validateEmployee(form);
    if (res.errors) {
      setErrors(res.errors);
      return;
    }
    setBusy(true);
    try {
      const created = await create.mutateAsync(formToCreateInput(res.values));
      toast(`Employee ${form.employeeCode.trim()} created.`, "success");
      setForm(emptyEmployeeForm);
      setErrors({});
      onCreated(created.id);
    } catch (err) {
      const e = asApiError(err);
      const mapped = mapEmployeeError(e.code);
      if (mapped.field) {
        setErrors((prev) => ({ ...prev, [mapped.field as keyof EmployeeFormValues]: mapped.message }));
      }
      setBanner(mapped.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
          else onOpenChange(true);
        }}
      >
        <SheetContent
          className="w-[520px] max-w-[96%]"
          data-testid="employee-create-drawer"
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            requestClose();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            requestClose();
          }}
        >
          <SheetHeader kicker="HR" title="New employee" />
          <SheetBody>
            {!online && (
              <Alert tone="warning" className="mb-3" title="You're offline. Changes weren't saved." />
            )}
            {banner && (
              <Alert tone="destructive" className="mb-3" title={banner} data-testid="employee-create-banner" />
            )}
            <EmployeeProfileForm
              values={form}
              errors={errors}
              projects={projectOptions}
              disabled={busy || !online}
              onChange={patch}
            />
          </SheetBody>
          <SheetFooter>
            <Button variant="ghost" size="md" onClick={requestClose} disabled={busy} data-testid="employee-cancel">
              Cancel
            </Button>
            <Button
              size="md"
              onClick={onSubmit}
              disabled={busy || !online}
              data-testid="employee-save"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent data-testid="employee-discard-confirm">
          <DialogTitle>Discard this new employee?</DialogTitle>
          <DialogDescription>Your entered details will be lost.</DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDiscardOpen(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" size="sm" onClick={resetAndClose} data-testid="employee-discard-confirm-yes">
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
