"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerInput } from "@/components/ui/date-picker";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { PRIORITIES, PRIORITY_LABEL } from "../schemas/requisition.schema";
import { type RequisitionFormValues } from "../schemas/requisition.schema";
import {
  type CostCentreOption,
  type GodownOption,
  type ProjectOption,
  type PurposeOption,
  type UserOption,
} from "../types";
import { resolveApprover } from "../lib/resolve-approver";

type Errors = Partial<Record<keyof RequisitionFormValues, string>>;

/**
 * Requisition header fields (spec §4/§7): project · cost centre · req. date (system, read-only) ·
 * required by · requested by (read-only, current user) · priority · deliver-to (the from-godown
 * field, relabeled to match the design's delivery framing) · purpose (+ inline create) ·
 * narration, plus a read-only Approver preview. Cost centre offers ANY active company CC (no
 * project filter, FR-REQ-002); purpose/godown are project-scoped. All controls share the
 * design-system focus/error states.
 */
export function RequisitionHeaderFields({
  values,
  errors,
  disabled,
  isNew,
  createdAt,
  projects,
  costCentres,
  purposes,
  godowns,
  users,
  purposesLoading,
  onChange,
  onAddPurpose,
}: {
  values: RequisitionFormValues;
  errors: Errors;
  disabled?: boolean;
  /** True for a brand-new draft — Req. date shows today rather than a persisted `createdAt`. */
  isNew: boolean;
  /** The saved requisition's creation timestamp (ISO), when editing an existing draft. */
  createdAt?: string | null;
  projects: ProjectOption[];
  costCentres: CostCentreOption[];
  purposes: PurposeOption[];
  godowns: GodownOption[];
  users: UserOption[];
  purposesLoading?: boolean;
  onChange: (patch: Partial<RequisitionFormValues>) => void;
  onAddPurpose: (name: string) => void;
}) {
  const [addingPurpose, setAddingPurpose] = useState(false);
  const [newPurpose, setNewPurpose] = useState("");
  const me = useAuthenticatedUser();
  const openProjects = projects.filter((p) => p.status !== "CLOSED");
  const selectedProject = projects.find((p) => p.id === values.projectId);
  const approver = resolveApprover(selectedProject, users);
  const reqDateDisplay = isNew || !createdAt ? formatDate(new Date().toISOString()) : formatDate(createdAt);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <FormField label="Project" htmlFor="req-project" required error={errors.projectId}>
          <Select id="req-project" value={values.projectId} disabled={disabled} invalid={!!errors.projectId} data-testid="req-project"
            onChange={(e) => onChange({ projectId: e.target.value })}>
            <option value="">Select a project…</option>
            {openProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}</option>
            ))}
          </Select>
        </FormField>

        <FormField label="Cost centre" htmlFor="req-cc" required error={errors.costCentreId}>
          <Select id="req-cc" value={values.costCentreId} disabled={disabled} invalid={!!errors.costCentreId} data-testid="req-cost-centre"
            onChange={(e) => onChange({ costCentreId: e.target.value })}>
            <option value="">Select a cost centre…</option>
            {costCentres.filter((c) => c.isActive).map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </Select>
        </FormField>

        <FormField label="Req. date" htmlFor="req-created-date" hint="Set automatically">
          <div
            id="req-created-date"
            data-testid="req-created-date"
            className="flex h-9 items-center rounded-token border border-border-strong bg-muted px-3 text-sm text-muted-foreground"
          >
            {reqDateDisplay}
          </div>
        </FormField>

        <FormField label="Required by" htmlFor="req-date" required error={errors.requiredDate}>
          <DatePickerInput id="req-date" value={values.requiredDate} disabled={disabled} invalid={!!errors.requiredDate}
            onChange={(v) => onChange({ requiredDate: v })} />
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <FormField label="Requested by" htmlFor="req-requested-by" hint="You">
          <div
            id="req-requested-by"
            data-testid="req-requested-by"
            className="flex h-9 items-center rounded-token border border-border-strong bg-muted px-3 text-sm text-muted-foreground"
          >
            {me.name}
          </div>
        </FormField>

        <FormField label="Priority" htmlFor="req-priority" required>
          <div role="radiogroup" aria-label="Priority" data-testid="req-priority" className="flex h-9 overflow-hidden rounded-token border border-border-strong">
            {PRIORITIES.map((p) => {
              const active = values.priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled}
                  data-testid={`req-priority-toggle-${p}`}
                  onClick={() => onChange({ priority: p })}
                  className={cn(
                    "flex-1 border-l border-border-strong text-[13px] font-medium first:border-l-0 disabled:cursor-not-allowed disabled:opacity-60",
                    active ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {PRIORITY_LABEL[p]}
                </button>
              );
            })}
          </div>
        </FormField>

        <FormField label="Deliver to" htmlFor="req-godown" error={errors.fromGodownId} hint="Optional — may be set at issue">
          <Select id="req-godown" value={values.fromGodownId} disabled={disabled || !values.projectId} invalid={!!errors.fromGodownId} data-testid="req-godown"
            onChange={(e) => onChange({ fromGodownId: e.target.value })}>
            <option value="">No godown</option>
            {godowns.filter((g) => g.isActive).map((g) => (
              <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
            ))}
          </Select>
        </FormField>

        <FormField label="Purpose" htmlFor="req-purpose" required error={errors.purposeId}>
          <div className="flex flex-col gap-1.5">
            <Select id="req-purpose" value={values.purposeId} disabled={disabled || !values.projectId} invalid={!!errors.purposeId} data-testid="req-purpose"
              onChange={(e) => onChange({ purposeId: e.target.value })}>
              <option value="">{values.projectId ? (purposesLoading ? "Loading…" : "Select a purpose…") : "Select a project first"}</option>
              {purposes.filter((p) => p.isActive).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            {!disabled && values.projectId && (
              addingPurpose ? (
                <div className="flex items-center gap-2">
                  <Input value={newPurpose} placeholder="New purpose name" data-testid="req-purpose-new" onChange={(e) => setNewPurpose(e.target.value)} />
                  <Button type="button" size="sm" data-testid="req-purpose-add"
                    onClick={() => { if (newPurpose.trim()) { onAddPurpose(newPurpose.trim()); setNewPurpose(""); setAddingPurpose(false); } }}>
                    Add
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setAddingPurpose(false); setNewPurpose(""); }}>Cancel</Button>
                </div>
              ) : (
                <button type="button" onClick={() => setAddingPurpose(true)} data-testid="req-purpose-addtoggle"
                  className="inline-flex w-fit items-center gap-1 text-[12px] font-semibold text-accent-ink hover:underline">
                  <Plus className="h-3 w-3" aria-hidden /> Add purpose
                </button>
              )
            )}
          </div>
        </FormField>
      </div>

      {approver && (
        <div className="flex items-center gap-2 border-t border-border pt-3.5" data-testid="req-approver">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Approver</span>
          <span className="text-[13px] text-foreground">
            {approver.name ? `${approver.name} — ${approver.label}` : approver.label}
          </span>
        </div>
      )}

      <FormField label="Narration" htmlFor="req-narration" hint="Optional">
        <Textarea id="req-narration" value={values.narration} disabled={disabled} rows={2} data-testid="req-narration"
          onChange={(e) => onChange({ narration: e.target.value })} />
      </FormField>
    </div>
  );
}

function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const errId = `${htmlFor}-err`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
      </Label>
      {children}
      {error ? (
        <p id={errId} className="text-[12px] text-destructive-ink" role="alert">{error}</p>
      ) : hint ? (
        <p className={cn("text-[11.5px] text-faint")}>{hint}</p>
      ) : null}
    </div>
  );
}
