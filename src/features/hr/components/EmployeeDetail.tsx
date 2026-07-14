"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { asApiError } from "@/lib/api";
import { useOnline } from "@/lib/hooks/use-online";
import { useMasterLookups } from "@/lib/masters/lookups";
import { useAuthenticatedUser } from "@/providers/session-provider";
import {
  canDeactivateEmployee,
  canRevealBank,
  canWriteEmployee,
} from "../access";
import { useEmployee } from "../hooks/useEmployee";
import { useAssignments } from "../hooks/useAssignments";
import { useEmployeeMutations } from "../hooks/useEmployeeMutations";
import { EmployeeProfileDetailForm } from "./EmployeeProfileDetailForm";
import { EmployeeStatusBadge } from "./StatusBadge";
import { AssignmentHistory } from "./AssignmentHistory";
import { MaskedBankField } from "./MaskedBankField";
import { ReassignDialog } from "./ReassignDialog";
import { useProjectOptions } from "../hooks/useProjectOptions";
import { DeactivateDialog } from "./DeactivateDialog";
import {
  employeeToForm,
  emptyEmployeeForm,
  formToUpdateInput,
  mapEmployeeError,
  validateEmployee,
  WORK_BASE_LABEL,
  type EmployeeFieldErrors,
  type EmployeeFormValues,
} from "../schemas/employee.schema";
import { formatDate } from "@/lib/format";
import { type Employee } from "../types";

type Tab = "profile" | "history";

/**
 * Employee detail page (spec §3/§4/§6). Full-page tabs: Profile (identity → wage → bank →
 * PF/gratuity/WPPF/TIN, edited in place) and Assignment history (append-only). Reassign +
 * Deactivate/Reactivate live in the header. Bank fields render masked with a role-gated
 * `Show`/`Hide` reveal (NFR-002). `employeeCode` disables (with tooltip) once the employee
 * has any attendance/salary reference — pre-empting `IMMUTABLE_EMPLOYEE_CODE`. Roles: HR /
 * Admin write; Accounts read-only (masked bank); Site Engineer / Store Keeper / PM never
 * reach this route (server 403 + module guard redirect).
 */
export function EmployeeDetail({ employeeId }: { employeeId: string }) {
  const user = useAuthenticatedUser();
  const online = useOnline();
  const { toast } = useToast();
  const canWrite = canWriteEmployee(user);
  const canReveal = canRevealBank(user);
  const canDeactivate = canDeactivateEmployee(user);

  const [tab, setTab] = useState<Tab>("profile");
  const [revealed, setRevealed] = useState(false);
  const [form, setForm] = useState<EmployeeFormValues>(emptyEmployeeForm);
  const [errors, setErrors] = useState<EmployeeFieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  const detail = useEmployee(employeeId, { reveal: revealed });
  const employee: Employee | undefined = detail.data;
  const assignments = useAssignments(employeeId);
  const { update } = useEmployeeMutations();
  const lookups = useMasterLookups();
  const projectOptions = useProjectOptions();

  // Populate the form once the employee loads (edit view). Reload on version bump so a
  // save/reassign/deactivate reconciles the visible form to server state.
  useEffect(() => {
    if (!employee) return;
    setForm(employeeToForm(employee));
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id, employee?.version, employee?.status]);

  const codeLocked = !!employee?.hasReferences;
  const editable = canWrite && !!employee && !busy;

  const profileProjectOptions = useMemo(() => {
    const fetched = (projectOptions.data ?? []).map((p) => ({ id: p.id, projectCode: "", name: p.name }));
    if (fetched.length > 0) return fetched;
    if (!employee?.defaultProjectId) return [];
    return [
      {
        id: employee.defaultProjectId,
        projectCode: "",
        name: lookups.project(employee.defaultProjectId),
      },
    ];
  }, [projectOptions.data, employee?.defaultProjectId, lookups]);

  function patch(p: Partial<EmployeeFormValues>) {
    setBanner(null);
    setForm((prev) => ({ ...prev, ...p }));
    setErrors((prev) => {
      const copy = { ...prev };
      for (const k of Object.keys(p)) delete copy[k as keyof EmployeeFormValues];
      return copy;
    });
  }

  async function onSave() {
    if (!employee) return;
    setBanner(null);
    const res = validateEmployee(form);
    if (res.errors) {
      setErrors(res.errors);
      return;
    }
    setBusy(true);
    try {
      await update.mutateAsync({
        id: employee.id,
        input: formToUpdateInput(res.values, employee.version),
      });
      toast("Changes saved.", "success");
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

  // ── loading ──
  if (detail.isLoading) {
    return (
      <div className="mx-auto max-w-5xl" data-testid="employee-detail-loading">
        <Breadcrumb items={[{ label: "HR" }, { label: "Employees", href: "/hr/employees" }, { label: "Loading…" }]} />
        <div className="mt-4 flex flex-col gap-3">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // ── error ──
  if (detail.isError || !employee) {
    return (
      <div className="mx-auto max-w-3xl" data-testid="employee-detail-error">
        <Breadcrumb items={[{ label: "HR" }, { label: "Employees", href: "/hr/employees" }, { label: "Not found" }]} />
        <Alert tone="destructive" className="mt-4" title="Couldn't load this employee.">
          <div className="flex flex-col items-start gap-2">
            <span>Check your connection and try again.</span>
            <Button size="sm" onClick={() => detail.refetch()} data-testid="employee-detail-retry">
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  const projName = employee.defaultProjectId
    ? (lookups.project(employee.defaultProjectId) === employee.defaultProjectId
        ? `${employee.defaultProjectId.slice(0, 8)} (project name unavailable)`
        : lookups.project(employee.defaultProjectId))
    : "— Unassigned —";

  return (
    <div className="mx-auto max-w-5xl" data-testid="employee-detail">
      <Breadcrumb
        items={[
          { label: "HR" },
          { label: "Employees", href: "/hr/employees" },
          { label: employee.employeeCode },
        ]}
      />

      <div className="mb-4 mt-1 flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[23px] font-bold tracking-[-0.01em] [overflow-wrap:anywhere]" data-testid="employee-name">
              {employee.name}
            </h1>
            <EmployeeStatusBadge status={employee.status} />
          </div>
          <div className="mt-0.5 text-[12.5px] text-muted-foreground">
            {employee.designation ?? "—"} · {WORK_BASE_LABEL[employee.workBase]} · Default project{" "}
            <span className="font-medium text-foreground">{projName}</span> · Joined{" "}
            <span className="font-mono tabular-nums">{formatDate(employee.joiningDate)}</span>
          </div>
        </div>

        {canWrite && (
          <div className="ml-auto flex flex-none flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="md"
              onClick={() => setReassignOpen(true)}
              data-testid="employee-reassign"
            >
              Reassign
            </Button>
            {canDeactivate &&
              (employee.status === "ACTIVE" ? (
                <Button
                  variant="destructive-outline"
                  size="md"
                  onClick={() => setDeactivateOpen(true)}
                  data-testid="employee-deactivate"
                >
                  Deactivate
                </Button>
              ) : (
                <Button
                  size="md"
                  onClick={() => setDeactivateOpen(true)}
                  data-testid="employee-reactivate"
                >
                  Reactivate
                </Button>
              ))}
          </div>
        )}
      </div>

      {!online && (
        <Alert tone="warning" className="mb-3" title="You're offline. Changes weren't saved." />
      )}

      {/* Tabs */}
      <div className="mb-3 mt-4 flex items-end gap-6 border-b border-border" role="tablist">
        <TabButton active={tab === "profile"} onClick={() => setTab("profile")} testId="tab-profile">
          Profile
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")} testId="tab-history">
          Assignment history
          {assignments.data && (
            <span className="inline-flex h-[18px] items-center rounded-pill bg-muted px-[7px] text-[10.5px] font-semibold text-muted-foreground">
              {assignments.data.length}
            </span>
          )}
        </TabButton>
      </div>

      {tab === "profile" ? (
        <div role="tabpanel" aria-labelledby="tab-profile">
          {banner && (
            <Alert tone="destructive" className="mb-3" title={banner} data-testid="employee-detail-banner" />
          )}

          <EmployeeProfileDetailForm
            values={form}
            errors={errors}
            projects={profileProjectOptions}
            codeLocked={codeLocked}
            disabled={!editable || !online}
            joiningDateIso={employee.joiningDate}
            onChange={patch}
            onReassignClick={canWrite ? () => setReassignOpen(true) : undefined}
            bankHeaderSlot={
              canReveal ? (
                <button
                  type="button"
                  aria-pressed={revealed}
                  aria-label={revealed ? "Hide bank details" : "Show bank details"}
                  onClick={() => setRevealed((v) => !v)}
                  disabled={detail.isFetching}
                  data-testid="bank-reveal-toggle"
                  className="ml-auto inline-flex h-[26px] items-center gap-1.5 rounded-token border border-border-strong bg-surface px-2.5 text-[11.5px] font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {revealed ? "Hide" : "Show"}
                </button>
              ) : (
                <span className="ml-auto text-[11px] text-faint">Masked — no reveal for your role</span>
              )
            }
            bankFieldsSlot={
              <div className="grid grid-cols-2 gap-3">
                <MaskedBankField
                  label="Bank account name"
                  value={employee.bankAccountName ?? "—"}
                  masked={employee.bankMasked}
                  canReveal={false}
                  isRevealed={revealed}
                  onToggle={() => setRevealed((v) => !v)}
                  loading={detail.isFetching}
                  testId="bank-account-name"
                />
                <MaskedBankField
                  label="Bank account no."
                  value={employee.bankAccountNo ?? "—"}
                  masked={employee.bankMasked}
                  canReveal={false}
                  isRevealed={revealed}
                  onToggle={() => setRevealed((v) => !v)}
                  loading={detail.isFetching}
                  testId="bank-account-no"
                />
              </div>
            }
          />

          <Alert
            tone="info"
            className="mt-4"
            title="Only named office staff belong here. Subcontractor and daily-labour workers are tracked as head counts on the Attendance screen."
          />

          {canWrite && (
            <div className="mt-4 flex items-center justify-end gap-2.5">
              <Button variant="ghost" size="md" onClick={() => setForm(employeeToForm(employee))} disabled={busy}>
                Cancel
              </Button>
              <Button
                size="md"
                onClick={onSave}
                disabled={!editable || !online}
                data-testid="employee-save-edit"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Save
              </Button>
            </div>
          )}

          {!canWrite && (
            <div className="mt-4 text-[12.5px] text-muted-foreground">
              You have read-only access to this employee. Bank details are masked for your role.
            </div>
          )}
        </div>
      ) : (
        <Card className="p-5" role="tabpanel" aria-labelledby="tab-history">
          <AssignmentHistory employeeId={employee.id} joiningDate={employee.joiningDate} />
        </Card>
      )}

      {canWrite && (
        <ReassignDialog
          employee={employee}
          open={reassignOpen}
          onOpenChange={setReassignOpen}
          projectOptions={projectOptions.data}
        />
      )}
      {canDeactivate && (
        <DeactivateDialog
          employee={employee}
          open={deactivateOpen}
          onOpenChange={setDeactivateOpen}
          mode={employee.status === "ACTIVE" ? "deactivate" : "reactivate"}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  testId,
  children,
}: {
  active: boolean;
  onClick: () => void;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      id={testId}
      aria-selected={active}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "-mb-px inline-flex items-center gap-1.5 border-b-2 px-0.5 pb-2.5 text-[13.5px] transition-colors",
        active
          ? "border-accent font-semibold text-foreground"
          : "border-transparent font-medium text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
