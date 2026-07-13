"use client";

import { AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { PROJECT_OPTIONS } from "../seed/employees";
import { type Employee } from "../types";
import { reassignSchema, type ReassignFormValues } from "../schemas/employee.schema";

const isBn = (s: string) => /[ঀ-৿]/.test(s);

/** The employee name, tagged with the Bangla font class when it contains Bangla. */
function EmployeeName({ name }: { name: string }) {
  return <span className={cn(isBn(name) && "font-sans")}>{name}</span>;
}

/**
 * Reassign dialog (FR-HR-002; Employees.dc.html). Appends a new assignment-history
 * entry — the prior assignment is kept, never overwritten. New project + effective
 * date required; the effective date cannot precede the joining date. Note optional.
 */
export function ReassignDialog({
  employee,
  onClose,
  onDone,
}: {
  employee: Employee | null;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { toast } = useToast();
  const joiningDisplay = employee ? safeDate(employee.joiningDate) : "";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReassignFormValues>({
    resolver: zodResolver(reassignSchema),
    defaultValues: { projectId: "", effectiveDate: "", note: "" },
  });

  function onSubmit() {
    // Mockup: no persistence — confirm the append and close.
    toast(employee ? `${employee.name} reassigned.` : "Reassigned.", "success");
    reset();
    onDone?.();
    onClose();
  }

  return (
    <Dialog open={!!employee} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[408px] p-0" data-testid="reassign-dialog">
        {employee && (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="px-5 pb-1 pt-5">
              <DialogTitle className="text-[16.5px] tracking-[-0.01em]">
                Reassign <EmployeeName name={employee.name} />
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-[12.5px] leading-relaxed">
                This adds a new entry to the assignment history. The prior assignment is kept, never
                overwritten.
              </DialogDescription>
            </div>

            <div className="flex flex-col gap-3.5 px-5 py-3.5">
              <div>
                <Label htmlFor="rd-project" className="mb-1.5 block text-[11px]">
                  New project <span className="text-destructive">*</span>
                </Label>
                <Select id="rd-project" invalid={!!errors.projectId} {...register("projectId")}>
                  <option value="">Choose a project…</option>
                  {PROJECT_OPTIONS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                  <option value="Head Office">Head Office</option>
                </Select>
                {errors.projectId && (
                  <p className="mt-1.5 text-[11.5px] text-destructive-ink">
                    {errors.projectId.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="rd-date" className="mb-1.5 block text-[11px]">
                  Effective date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="rd-date"
                  className="max-w-[200px] font-mono"
                  placeholder="DD/MM/YYYY"
                  invalid={!!errors.effectiveDate}
                  {...register("effectiveDate")}
                />
                {errors.effectiveDate ? (
                  <p className="mt-1.5 text-[11.5px] text-destructive-ink">
                    {errors.effectiveDate.message}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11.5px] text-faint">
                    Effective date can’t be before the joining date (
                    <span className="font-mono tabular-nums">{joiningDisplay}</span>).
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="rd-note" className="mb-1.5 block text-[11px]">
                  Note{" "}
                  <span className="font-medium normal-case tracking-normal text-faint">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="rd-note"
                  rows={2}
                  placeholder="Why is this reassignment happening?"
                  {...register("note")}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 px-5 pb-5 pt-2">
              <Button type="button" variant="ghost" size="md" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="md" data-testid="reassign-submit">
                Reassign
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Deactivate / reactivate confirm (FR-HR-003; Employees.dc.html). Deactivation
 * excludes the employee from new attendance and salary cycles; history stays intact
 * and they can be reactivated anytime. Reversible — the reactivate side is a plain
 * confirm.
 */
export function StatusDialog({
  employee,
  mode,
  onClose,
  onDone,
}: {
  employee: Employee | null;
  mode: "deactivate" | "reactivate";
  onClose: () => void;
  onDone?: () => void;
}) {
  const { toast } = useToast();
  const isDeactivate = mode === "deactivate";

  function confirm() {
    if (!employee) return;
    toast(
      isDeactivate ? `${employee.name} deactivated.` : `${employee.name} reactivated.`,
      "success",
    );
    onDone?.();
    onClose();
  }

  return (
    <Dialog open={!!employee} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[372px]" hideClose data-testid="status-dialog">
        {employee && (
          <>
            {isDeactivate && (
              <div className="grid h-[42px] w-[42px] place-items-center rounded-full bg-destructive-soft text-destructive-ink">
                <AlertTriangle className="h-[19px] w-[19px]" aria-hidden />
              </div>
            )}
            <DialogTitle className="mt-3 text-[16.5px] tracking-[-0.01em]">
              {isDeactivate ? (
                <>
                  Deactivate <EmployeeName name={employee.name} />?
                </>
              ) : (
                <>
                  Reactivate <EmployeeName name={employee.name} />?
                </>
              )}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-[13px] leading-relaxed">
              {isDeactivate
                ? "They’ll be excluded from new attendance and salary cycles. Their history stays intact, and you can reactivate them anytime."
                : "They’ll be included again in new attendance and salary cycles. Their history is unaffected."}
            </DialogDescription>
            <div className="mt-4 flex justify-end gap-2.5">
              <Button type="button" variant="ghost" size="md" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={isDeactivate ? "destructive" : "primary"}
                size="md"
                onClick={confirm}
                data-testid="status-confirm"
              >
                {isDeactivate ? "Deactivate" : "Reactivate"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function safeDate(iso: string): string {
  try {
    return formatDate(iso);
  } catch {
    return iso;
  }
}
