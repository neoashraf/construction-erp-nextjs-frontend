"use client";

import { Lock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  WAGE_TYPE_LABEL,
  WORK_BASE_LABEL,
  type EmployeeFieldErrors,
  type EmployeeFormValues,
} from "../schemas/employee.schema";
import { type WageType, type WorkBase } from "../types";
import { SegmentedToggle } from "./SegmentedToggle";

interface ProjectOption {
  id: string;
  projectCode: string;
  name: string;
}

const WORK_BASE_OPTIONS = (["HEAD_OFFICE", "SITE"] as const).map((v) => ({
  value: v,
  label: WORK_BASE_LABEL[v],
}));
const WAGE_TYPE_OPTIONS = (["MONTHLY", "DAILY"] as const).map((v) => ({
  value: v,
  label: v === "MONTHLY" ? "Monthly" : "Daily",
}));

/**
 * Employee detail — Profile tab layout (Employees.dc.html detail mockup). Two titled
 * cards side by side: "Identity & wage" (left) and "Bank & statutory" (right), matching
 * the design file exactly — distinct from the single-column `EmployeeProfileForm` used
 * by the create drawer, which follows the drawer's own (different) mockup layout.
 * Joining date is shown read-only (immutable after create) rather than omitted, per the
 * mockup's read-only date field with a calendar glyph.
 */
export function EmployeeProfileDetailForm({
  values,
  errors,
  projects,
  codeLocked,
  disabled,
  joiningDateIso,
  onChange,
  onReassignClick,
  bankHeaderSlot,
  bankFieldsSlot,
}: {
  values: EmployeeFormValues;
  errors: EmployeeFieldErrors;
  projects: ProjectOption[];
  codeLocked?: boolean;
  disabled?: boolean;
  /** `YYYY-MM-DD` — rendered read-only, `DD/MM/YYYY`. */
  joiningDateIso: string;
  onChange: (patch: Partial<EmployeeFormValues>) => void;
  /** Opens the Reassign dialog — linked from the Default-project helper text. */
  onReassignClick?: () => void;
  /** The Show/Hide reveal button, rendered in the card header next to the title. */
  bankHeaderSlot?: React.ReactNode;
  /** The two masked bank fields (account name / no.), rendered where the mockup places them. */
  bankFieldsSlot?: React.ReactNode;
}) {
  return (
    <div className="grid gap-[18px] md:grid-cols-2 md:items-start">
      {/* ── LEFT — Identity & wage ── */}
      <Card>
        <CardHeader className="border-b-0 pb-0">
          <CardTitle className="text-[11px] uppercase tracking-[0.5px] text-muted-foreground">
            Identity &amp; wage
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-[15px] pt-[15px]">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employee code" required hint={codeLocked ? "" : undefined}>
              <div className="relative">
                <Input
                  value={values.employeeCode}
                  disabled
                  data-testid="emp-code"
                  data-locked={codeLocked ? "true" : undefined}
                  className={cn("bg-muted font-mono text-foreground", codeLocked && "pr-9")}
                />
                {codeLocked && (
                  <span
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    title="This employee code can't be changed — it's already used in attendance or salary."
                    aria-hidden
                  >
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              {codeLocked && (
                <p className="text-[11.5px] text-faint">
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
              {!errors.name && (
                <p className="text-[11.5px] leading-snug text-faint">Bangla or English — shown on salary sheets.</p>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Designation" htmlFor="emp-designation">
              <Input
                id="emp-designation"
                value={values.designation}
                onChange={(e) => onChange({ designation: e.target.value })}
                disabled={disabled}
                data-testid="emp-designation"
              />
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
          </div>

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
            <p className="text-[11.5px] leading-snug text-faint">
              A default-tagging convenience only — change it with{" "}
              {onReassignClick ? (
                <button type="button" onClick={onReassignClick} className="font-semibold text-foreground hover:underline">
                  Reassign
                </button>
              ) : (
                <span className="font-semibold text-foreground">Reassign</span>
              )}{" "}
              so the assignment history is kept. Never posts to the ledger.
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Work base" required error={errors.workBase}>
              <SegmentedToggle
                aria-label="Work base"
                data-testid="emp-workbase"
                value={values.workBase}
                options={WORK_BASE_OPTIONS}
                disabled={disabled}
                onChange={(v: WorkBase) => onChange({ workBase: v })}
              />
            </Field>
            <Field label="Wage type" required error={errors.wageType}>
              <SegmentedToggle
                aria-label="Wage type"
                data-testid="emp-wagetype"
                value={values.wageType}
                options={WAGE_TYPE_OPTIONS}
                disabled={disabled}
                onChange={(v: WageType) => onChange({ wageType: v })}
              />
            </Field>
          </div>

          <Field
            label={values.wageType === "DAILY" ? WAGE_TYPE_LABEL.DAILY : WAGE_TYPE_LABEL.MONTHLY}
            required
            error={errors.wageAmount}
          >
            <div className="flex h-9 max-w-[240px] items-center rounded-token border border-border-strong bg-background">
              <span className="flex-none border-r border-border px-2.5 font-medium text-muted-foreground">
                ৳
              </span>
              <input
                value={values.wageAmount}
                onChange={(e) => onChange({ wageAmount: e.target.value })}
                disabled={disabled}
                inputMode="decimal"
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-right font-mono text-sm text-foreground outline-none disabled:cursor-not-allowed"
                data-testid="emp-wageamount"
              />
            </div>
            {!errors.wageAmount && (
              <p className="text-[11.5px] leading-snug text-faint">
                Label follows the wage type — &ldquo;Daily rate&rdquo; for daily-paid staff.
              </p>
            )}
          </Field>
        </CardContent>
      </Card>

      {/* ── RIGHT — Bank & statutory ── */}
      <Card>
        <CardHeader className="items-center gap-2.5 border-b-0 pb-0">
          <CardTitle className="text-[11px] uppercase tracking-[0.5px] text-muted-foreground">
            Bank &amp; statutory
          </CardTitle>
          {bankHeaderSlot}
        </CardHeader>
        <CardContent className="flex flex-col gap-[15px] pt-[15px]">
          <Field label="Bank name" htmlFor="emp-bank-institution">
            <Input
              id="emp-bank-institution"
              value={values.bankName}
              onChange={(e) => onChange({ bankName: e.target.value })}
              disabled={disabled}
              data-testid="emp-bank-institution"
            />
          </Field>

          {bankFieldsSlot}

          <div className="h-px bg-border" />

          <div className="flex flex-col gap-3">
            <ToggleRow
              label="PF applicable"
              checked={values.pfApplicable}
              onChange={(v) => onChange({ pfApplicable: v })}
              disabled={disabled}
              testId="emp-pf"
            />
            <ToggleRow
              label="Gratuity applicable"
              checked={values.gratuityApplicable}
              onChange={(v) => onChange({ gratuityApplicable: v })}
              disabled={disabled}
              testId="emp-gratuity"
            />
            <ToggleRow
              label="WPPF applicable"
              hint="Applicability is pending confirmation — safe to leave off until finance confirms."
              checked={values.wppfApplicable}
              onChange={(v) => onChange({ wppfApplicable: v })}
              disabled={disabled}
              testId="emp-wppf"
            />
          </div>

          <div className="h-px bg-border" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="TIN" htmlFor="emp-tin" error={errors.tin} hint="12 digits.">
              <Input
                id="emp-tin"
                value={values.tin}
                onChange={(e) => onChange({ tin: e.target.value })}
                invalid={!!errors.tin}
                disabled={disabled}
                inputMode="numeric"
                className="font-mono"
                data-testid="emp-tin"
              />
            </Field>
            <Field label="Joining date">
              <Input
                value={joiningDateIso ? formatDate(joiningDateIso) : "—"}
                disabled
                data-testid="emp-joining"
                className="bg-muted font-mono tabular-nums text-foreground"
              />
            </Field>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Switch checked={checked} onChange={onChange} disabled={disabled} data-testid={testId} />
      <div className={cn("min-w-0", !disabled && "cursor-pointer")} onClick={() => !disabled && onChange(!checked)}>
        <span className="text-[13.5px] font-medium text-foreground">{label}</span>
        {hint && <p className="mt-0.5 text-[11.5px] leading-snug text-faint">{hint}</p>}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
      >
        {label} {required && <span className="text-destructive">*</span>}
        {hint && <span className="ml-1 font-normal normal-case tracking-normal text-faint">{hint}</span>}
      </label>
      {children}
      {error && (
        <p className="text-[12px] font-medium text-destructive" data-testid={htmlFor ? `${htmlFor}-err` : undefined}>
          {error}
        </p>
      )}
    </div>
  );
}
