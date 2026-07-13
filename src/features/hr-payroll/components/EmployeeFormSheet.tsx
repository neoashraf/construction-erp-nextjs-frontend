"use client";

import { Info } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { PROJECT_OPTIONS } from "../seed/employees";
import { type Employee } from "../types";
import { employeeSchema, type EmployeeFormValues } from "../schemas/employee.schema";
import { wageAmountLabel } from "../lib";
import { Toggle } from "./Toggle";

type Mode = { kind: "create" } | { kind: "edit"; employee: Employee };

const isBn = (s: string) => /[ঀ-৿]/.test(s);

/** Uppercase micro-label above a field (per Employees.dc.html). */
function FieldLabel({
  htmlFor,
  required,
  invalid,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className={cn("mb-1.5 block text-[10.5px]", invalid && "text-destructive-ink")}
    >
      {children} {required && <span className="text-destructive">*</span>}
    </Label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-bold uppercase tracking-[0.6px] text-faint">{children}</div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-[11.5px] text-destructive-ink">{message}</p>;
}

/**
 * Employee create/edit drawer (FR-HR-001; Employees.dc.html new-employee drawer). A
 * right-side Sheet with four sections — Identity · Wage · Bank · Statutory — plus the
 * "office staff only" info banner. The wage-amount label follows the wage type. On a
 * mockup the save surfaces a success toast and closes (no persistence yet).
 */
export function EmployeeFormSheet({
  mode,
  onClose,
  onSaved,
}: {
  mode: Mode;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const isEdit = mode.kind === "edit";
  const editing = isEdit ? mode.employee : null;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: editing
      ? {
          employeeCode: editing.employeeCode,
          name: editing.name,
          designation: editing.designation,
          department: editing.department ?? "",
          defaultProjectId: editing.defaultProjectId ?? "",
          workBase: editing.workBase,
          wageType: editing.wageType,
          wageAmount: editing.wageAmount,
          bankName: editing.bankName ?? "",
          bankAccountName: "",
          bankAccountNo: "",
          pfApplicable: editing.pfApplicable,
          gratuityApplicable: editing.gratuityApplicable,
          wppfApplicable: editing.wppfApplicable,
          tin: editing.tin ?? "",
          joiningDate: (() => {
            try {
              return formatDate(editing.joiningDate);
            } catch {
              return "";
            }
          })(),
        }
      : {
          employeeCode: "",
          name: "",
          designation: "",
          department: "",
          defaultProjectId: "",
          workBase: "HEAD_OFFICE",
          wageType: "MONTHLY",
          wageAmount: "",
          bankName: "",
          bankAccountName: "",
          bankAccountNo: "",
          pfApplicable: false,
          gratuityApplicable: false,
          wppfApplicable: false,
          tin: "",
          joiningDate: "",
        },
  });

  const wageType = watch("wageType");
  const pf = watch("pfApplicable");
  const gratuity = watch("gratuityApplicable");
  const wppf = watch("wppfApplicable");

  function onSubmit(values: EmployeeFormValues) {
    // Mockup: no backend persistence. Confirm the write and close.
    toast(isEdit ? `${values.name} updated.` : `${values.name} added.`, "success");
    onSaved?.();
    onClose();
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[492px]" data-testid="employee-form-sheet">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex h-full flex-col">
          <SheetHeader title={isEdit ? "Edit employee" : "New employee"} />

          <SheetBody className="flex flex-col gap-0 p-0">
            {/* office-staff-only banner */}
            <div className="px-6 pt-5">
              <div className="flex gap-2.5 rounded-token border border-border bg-info-soft px-3 py-2.5">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-none text-info-ink" aria-hidden />
                <span className="text-[12px] leading-relaxed text-info-ink">
                  Only named office staff belong here. Subcontractor and daily-labour workers are
                  tracked as head counts on the Attendance screen.
                </span>
              </div>
            </div>

            {/* IDENTITY */}
            <section className="flex flex-col gap-3.5 px-6 py-5">
              <SectionTitle>Identity</SectionTitle>
              <div className="grid grid-cols-[150px_1fr] gap-3">
                <div className="min-w-0">
                  <FieldLabel htmlFor="ef-code" required invalid={!!errors.employeeCode}>
                    Employee code
                  </FieldLabel>
                  <Input
                    id="ef-code"
                    className="font-mono"
                    placeholder="EMP-0016"
                    disabled={isEdit}
                    invalid={!!errors.employeeCode}
                    {...register("employeeCode")}
                  />
                  <FieldError message={errors.employeeCode?.message} />
                </div>
                <div className="min-w-0">
                  <FieldLabel htmlFor="ef-name" required invalid={!!errors.name}>
                    Name
                  </FieldLabel>
                  <Input
                    id="ef-name"
                    placeholder="Full name — Bangla or English"
                    invalid={!!errors.name}
                    {...register("name")}
                  />
                  <FieldError message={errors.name?.message} />
                </div>
              </div>
              <p className="-mt-1 text-[11.5px] text-faint">
                {isEdit
                  ? "Code locks once the employee has any attendance or salary reference."
                  : "Code is editable here — it locks once the employee has any attendance or salary reference."}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <FieldLabel htmlFor="ef-desig" required invalid={!!errors.designation}>
                    Designation
                  </FieldLabel>
                  <Input
                    id="ef-desig"
                    placeholder="e.g. Site Accountant"
                    invalid={!!errors.designation}
                    {...register("designation")}
                  />
                  <FieldError message={errors.designation?.message} />
                </div>
                <div className="min-w-0">
                  <FieldLabel htmlFor="ef-dept">Department</FieldLabel>
                  <Input id="ef-dept" placeholder="e.g. Accounts" {...register("department")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <FieldLabel htmlFor="ef-project">Default project</FieldLabel>
                  <Select id="ef-project" {...register("defaultProjectId")}>
                    <option value="">— Unassigned —</option>
                    {PROJECT_OPTIONS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="min-w-0">
                  <FieldLabel htmlFor="ef-base" required>
                    Work base
                  </FieldLabel>
                  <Select id="ef-base" {...register("workBase")}>
                    <option value="HEAD_OFFICE">Head office</option>
                    <option value="SITE">Site</option>
                  </Select>
                </div>
              </div>
            </section>

            {/* WAGE */}
            <section className="flex flex-col gap-3.5 border-t border-border px-6 py-5">
              <SectionTitle>Wage</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <FieldLabel htmlFor="ef-wagetype" required>
                    Wage type
                  </FieldLabel>
                  <Select id="ef-wagetype" {...register("wageType")}>
                    <option value="MONTHLY">Monthly</option>
                    <option value="DAILY">Daily</option>
                  </Select>
                </div>
                <div className="min-w-0">
                  <FieldLabel htmlFor="ef-wage" required invalid={!!errors.wageAmount}>
                    {wageAmountLabel(wageType)} ৳
                  </FieldLabel>
                  <MoneyInput
                    id="ef-wage"
                    placeholder="0.0000"
                    invalid={!!errors.wageAmount}
                    {...register("wageAmount")}
                  />
                  <FieldError message={errors.wageAmount?.message} />
                </div>
              </div>
              <p className="-mt-1 text-[11.5px] text-faint">
                The amount label follows the wage type — “Monthly salary” or “Daily rate”.
              </p>
            </section>

            {/* BANK */}
            <section className="flex flex-col gap-3.5 border-t border-border px-6 py-5">
              <SectionTitle>Bank</SectionTitle>
              <div className="min-w-0">
                <FieldLabel htmlFor="ef-bank">Bank name</FieldLabel>
                <Input id="ef-bank" placeholder="e.g. Dutch-Bangla Bank" {...register("bankName")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <FieldLabel htmlFor="ef-bankname">Bank account name</FieldLabel>
                  <Input
                    id="ef-bankname"
                    placeholder="As printed on the cheque book"
                    {...register("bankAccountName")}
                  />
                </div>
                <div className="min-w-0">
                  <FieldLabel htmlFor="ef-bankno">Bank account number</FieldLabel>
                  <Input
                    id="ef-bankno"
                    className="font-mono"
                    placeholder="Account number"
                    {...register("bankAccountNo")}
                  />
                </div>
              </div>
            </section>

            {/* STATUTORY */}
            <section className="flex flex-col gap-3.5 border-t border-border px-6 py-5">
              <SectionTitle>Statutory</SectionTitle>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <Toggle
                  label="PF applicable"
                  checked={pf}
                  onChange={(v) => setValue("pfApplicable", v, { shouldDirty: true })}
                />
                <Toggle
                  label="Gratuity applicable"
                  checked={gratuity}
                  onChange={(v) => setValue("gratuityApplicable", v, { shouldDirty: true })}
                />
                <Toggle
                  label="WPPF applicable"
                  checked={wppf}
                  onChange={(v) => setValue("wppfApplicable", v, { shouldDirty: true })}
                />
              </div>
              <p className="-mt-1 text-[11.5px] text-faint">
                WPPF: applicability is pending confirmation — safe to leave off until finance
                confirms.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <FieldLabel htmlFor="ef-tin" invalid={!!errors.tin}>
                    TIN
                  </FieldLabel>
                  <Input
                    id="ef-tin"
                    className="font-mono"
                    placeholder="12-digit TIN"
                    invalid={!!errors.tin}
                    {...register("tin")}
                  />
                  <FieldError message={errors.tin?.message} />
                </div>
                <div className="min-w-0">
                  <FieldLabel htmlFor="ef-joining" required invalid={!!errors.joiningDate}>
                    Joining date
                  </FieldLabel>
                  <Input
                    id="ef-joining"
                    className="font-mono"
                    placeholder="DD/MM/YYYY"
                    invalid={!!errors.joiningDate}
                    {...register("joiningDate")}
                  />
                  <FieldError message={errors.joiningDate?.message} />
                </div>
              </div>
            </section>
          </SheetBody>

          <SheetFooter>
            <Button type="button" variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="md" data-testid="employee-save">
              Save
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export { isBn };
