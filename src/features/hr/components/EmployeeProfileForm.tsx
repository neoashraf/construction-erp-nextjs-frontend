"use client";

import { useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerInput } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import {
  WAGE_TYPE_LABEL,
  WORK_BASE_LABEL,
  type EmployeeFieldErrors,
  type EmployeeFormValues,
} from "../schemas/employee.schema";
import { type WageType, type WorkBase } from "../types";

interface ProjectOption {
  id: string;
  projectCode: string;
  name: string;
}

/**
 * The shared identity → wage → bank → PF/gratuity/WPPF → TIN → joining-date form (spec §7).
 * Rendered inside the create drawer AND inline on the detail Profile tab — same fields, same
 * validation. `employeeCode` disables (with tooltip) when `codeLocked` is true (the row already
 * has attendance/salary references) — pre-empting `IMMUTABLE_EMPLOYEE_CODE`. The wage-amount
 * label swaps ("Monthly salary" vs "Daily rate") on wage-type change and is announced via
 * `aria-live` (spec §10). The bank editor block accepts full re-entry — masked read + writeable
 * edit are the same field (edited value replaces the masked one on save).
 *
 * Design-system focus/error states come free from the shared `Input`/`Select`/`DatePickerInput`
 * primitives — no raw hex here.
 */
export function EmployeeProfileForm({
  values,
  errors,
  projects,
  codeLocked,
  disabled,
  isEdit,
  onChange,
  bankSlot,
}: {
  values: EmployeeFormValues;
  errors: EmployeeFieldErrors;
  projects: ProjectOption[];
  /** Disables the employee-code input (already referenced) — shows the lock tooltip. */
  codeLocked?: boolean;
  /** Locks the whole form (in-flight save / offline / permission-denied). */
  disabled?: boolean;
  /** Edit mode hides the joining-date input (immutable after create). */
  isEdit?: boolean;
  onChange: (patch: Partial<EmployeeFormValues>) => void;
  /** Optional custom bank fields (edit mode may swap in the MaskedBankField). */
  bankSlot?: React.ReactNode;
}) {
  const wageLabelRef = useRef<HTMLSpanElement>(null);

  // Announce the wage-amount label change to AT (spec §10 — aria-live="polite").
  useEffect(() => {
    if (wageLabelRef.current) wageLabelRef.current.setAttribute("aria-live", "polite");
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* ── Identity ── */}
      <Field label="Employee code" required htmlFor="emp-code" error={errors.employeeCode} hint={codeLocked ? "" : "Company-unique"}>
        <div className="relative">
          <Input
            id="emp-code"
            value={values.employeeCode}
            onChange={(e) => onChange({ employeeCode: e.target.value })}
            invalid={!!errors.employeeCode}
            disabled={disabled || codeLocked || isEdit}
            data-testid="emp-code"
            data-locked={codeLocked ? "true" : undefined}
            aria-describedby={codeLocked ? "emp-code-locked" : undefined}
            className={cn(codeLocked && "pr-9")}
          />
          {codeLocked && (
            <span
              id="emp-code-locked"
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              title="This employee code can't be changed — it's already used in attendance or salary."
              aria-hidden
            >
              <Lock className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        {codeLocked && (
          <p className="text-[11.5px] text-muted-foreground">
            This employee code can&apos;t be changed — it&apos;s already used in attendance or salary.
          </p>
        )}
      </Field>

      <Field label="Name" required htmlFor="emp-name" error={errors.name}>
        <Input
          id="emp-name"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          invalid={!!errors.name}
          disabled={disabled}
          data-testid="emp-name"
        />
      </Field>

      <Field label="Designation" htmlFor="emp-designation">
        <Input
          id="emp-designation"
          value={values.designation}
          onChange={(e) => onChange({ designation: e.target.value })}
          disabled={disabled}
          data-testid="emp-designation"
        />
      </Field>

      <Field label="Default project" htmlFor="emp-project" error={errors.defaultProjectId}>
        <Select
          id="emp-project"
          value={values.defaultProjectId}
          onChange={(e) => onChange({ defaultProjectId: e.target.value })}
          invalid={!!errors.defaultProjectId}
          disabled={disabled}
          data-testid="emp-project"
        >
          <option value="">— Unassigned —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Department" htmlFor="emp-department">
        <Input
          id="emp-department"
          value={values.department}
          onChange={(e) => onChange({ department: e.target.value })}
          disabled={disabled}
          data-testid="emp-department"
        />
      </Field>

      <Field label="Work base" required htmlFor="emp-workbase" error={errors.workBase}>
        <Select
          id="emp-workbase"
          value={values.workBase}
          onChange={(e) => onChange({ workBase: e.target.value as WorkBase })}
          invalid={!!errors.workBase}
          disabled={disabled}
          data-testid="emp-workbase"
        >
          <option value="">Select…</option>
          <option value="HEAD_OFFICE">{WORK_BASE_LABEL.HEAD_OFFICE}</option>
          <option value="SITE">{WORK_BASE_LABEL.SITE}</option>
        </Select>
      </Field>

      {/* ── Wage ── */}
      <Field label="Wage type" required htmlFor="emp-wagetype" error={errors.wageType}>
        <Select
          id="emp-wagetype"
          value={values.wageType}
          onChange={(e) => onChange({ wageType: e.target.value as WageType })}
          invalid={!!errors.wageType}
          disabled={disabled}
          data-testid="emp-wagetype"
        >
          <option value="">Select…</option>
          <option value="MONTHLY">{WAGE_TYPE_LABEL.MONTHLY}</option>
          <option value="DAILY">{WAGE_TYPE_LABEL.DAILY}</option>
        </Select>
      </Field>

      <div className="flex min-w-0 flex-col gap-1.5">
        <label
          htmlFor="emp-wageamount"
          className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
        >
          <span ref={wageLabelRef} data-testid="emp-wage-label">
            {values.wageType === "DAILY" ? WAGE_TYPE_LABEL.DAILY : WAGE_TYPE_LABEL.MONTHLY}
          </span>{" "}
          <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
            ৳
          </span>
          <Input
            id="emp-wageamount"
            value={values.wageAmount}
            onChange={(e) => onChange({ wageAmount: e.target.value })}
            invalid={!!errors.wageAmount}
            disabled={disabled}
            inputMode="decimal"
            className="pl-7 font-mono"
            data-testid="emp-wageamount"
          />
        </div>
        {errors.wageAmount && (
          <p className="text-[12px] font-medium text-destructive" data-testid="emp-wageamount-err">
            {errors.wageAmount}
          </p>
        )}
      </div>

      {/* ── Bank ── */}
      {bankSlot ? (
        <div className="md:col-span-2">{bankSlot}</div>
      ) : (
        <>
          <Field label="Bank account name" htmlFor="emp-bank-name">
            <Input
              id="emp-bank-name"
              value={values.bankAccountName}
              onChange={(e) => onChange({ bankAccountName: e.target.value })}
              disabled={disabled}
              data-testid="emp-bank-name"
            />
          </Field>
          <Field label="Bank account no." htmlFor="emp-bank-no">
            <Input
              id="emp-bank-no"
              value={values.bankAccountNo}
              onChange={(e) => onChange({ bankAccountNo: e.target.value })}
              disabled={disabled}
              data-testid="emp-bank-no"
            />
          </Field>
        </>
      )}

      <Field label="Bank name" htmlFor="emp-bank-institution">
        <Input
          id="emp-bank-institution"
          value={values.bankName}
          onChange={(e) => onChange({ bankName: e.target.value })}
          disabled={disabled}
          data-testid="emp-bank-institution"
        />
      </Field>

      {/* ── PF / Gratuity / WPPF ── */}
      <div className="flex min-w-0 flex-col gap-2 md:col-span-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          Benefits
        </span>
        <label className="flex items-center gap-2 text-[13px] text-foreground">
          <Checkbox
            checked={values.pfApplicable}
            onChange={(e) => onChange({ pfApplicable: e.target.checked })}
            disabled={disabled}
            data-testid="emp-pf"
          />
          PF applicable
        </label>
        <label className="flex items-center gap-2 text-[13px] text-foreground">
          <Checkbox
            checked={values.gratuityApplicable}
            onChange={(e) => onChange({ gratuityApplicable: e.target.checked })}
            disabled={disabled}
            data-testid="emp-gratuity"
          />
          Gratuity applicable
        </label>
        <label className="flex items-center gap-2 text-[13px] text-foreground">
          <Checkbox
            checked={values.wppfApplicable}
            onChange={(e) => onChange({ wppfApplicable: e.target.checked })}
            disabled={disabled}
            data-testid="emp-wppf"
          />
          WPPF applicable
        </label>
        <p className="text-[11.5px] text-faint">
          Applicability is pending confirmation — safe to leave off until finance confirms.
        </p>
      </div>

      {/* ── TIN + joining date ── */}
      <Field label="TIN" htmlFor="emp-tin" error={errors.tin} hint="12-digit NBR format">
        <Input
          id="emp-tin"
          value={values.tin}
          onChange={(e) => onChange({ tin: e.target.value })}
          invalid={!!errors.tin}
          disabled={disabled}
          inputMode="numeric"
          data-testid="emp-tin"
        />
      </Field>

      {!isEdit && (
        <Field label="Joining date" required htmlFor="emp-joining" error={errors.joiningDate}>
          <DatePickerInput
            id="emp-joining"
            value={values.joiningDate}
            onChange={(v) => onChange({ joiningDate: v })}
            invalid={!!errors.joiningDate}
            disabled={disabled}
            data-testid="emp-joining"
          />
        </Field>
      )}

      <p className="text-[11.5px] text-muted-foreground md:col-span-2">
        Only named office staff belong here. Subcontractor and daily-labour workers are tracked as
        head counts on the Attendance screen.
      </p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
      >
        {label} {required && <span className="text-destructive">*</span>}
        {hint && <span className="ml-1 font-normal normal-case tracking-normal text-faint">· {hint}</span>}
      </label>
      {children}
      {error && (
        <p
          className="text-[12px] font-medium text-destructive"
          data-testid={htmlFor ? `${htmlFor}-err` : undefined}
        >
          {error}
        </p>
      )}
    </div>
  );
}
