"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerInput } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { PRIORITIES, PRIORITY_LABEL } from "../schemas/requisition.schema";
import { type RequisitionFormValues } from "../schemas/requisition.schema";
import { type CostCentreOption, type GodownOption, type ProjectOption, type PurposeOption } from "../types";

type Errors = Partial<Record<keyof RequisitionFormValues, string>>;

/**
 * Requisition header fields (spec §4/§7): project · cost centre · purpose (+ inline create)
 * · required date · priority · optional from-godown · narration. Two columns at ≥lg, one
 * column below. Cost centre offers ANY active company CC (no project filter, FR-REQ-002);
 * purpose/godown are project-scoped. All controls share the design-system focus/error states.
 */
export function RequisitionHeaderFields({
  values,
  errors,
  disabled,
  projects,
  costCentres,
  purposes,
  godowns,
  purposesLoading,
  onChange,
  onAddPurpose,
}: {
  values: RequisitionFormValues;
  errors: Errors;
  disabled?: boolean;
  projects: ProjectOption[];
  costCentres: CostCentreOption[];
  purposes: PurposeOption[];
  godowns: GodownOption[];
  purposesLoading?: boolean;
  onChange: (patch: Partial<RequisitionFormValues>) => void;
  onAddPurpose: (name: string) => void;
}) {
  const [addingPurpose, setAddingPurpose] = useState(false);
  const [newPurpose, setNewPurpose] = useState("");
  const openProjects = projects.filter((p) => p.status !== "CLOSED");

  return (
    <div className="grid gap-4 md:grid-cols-2">
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

      <FormField label="Required date" htmlFor="req-date" required error={errors.requiredDate}>
        <DatePickerInput id="req-date" value={values.requiredDate} disabled={disabled} invalid={!!errors.requiredDate}
          onChange={(v) => onChange({ requiredDate: v })} />
      </FormField>

      <FormField label="Priority" htmlFor="req-priority" required error={undefined}>
        <Select id="req-priority" value={values.priority} disabled={disabled} data-testid="req-priority"
          onChange={(e) => onChange({ priority: e.target.value as RequisitionFormValues["priority"] })}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
          ))}
        </Select>
      </FormField>

      <FormField label="From godown" htmlFor="req-godown" error={errors.fromGodownId} hint="Optional — may be set at issue">
        <Select id="req-godown" value={values.fromGodownId} disabled={disabled || !values.projectId} invalid={!!errors.fromGodownId} data-testid="req-godown"
          onChange={(e) => onChange({ fromGodownId: e.target.value })}>
          <option value="">No godown</option>
          {godowns.filter((g) => g.isActive).map((g) => (
            <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
          ))}
        </Select>
      </FormField>

      <div className="md:col-span-2">
        <FormField label="Narration" htmlFor="req-narration" hint="Optional">
          <Textarea id="req-narration" value={values.narration} disabled={disabled} rows={2} data-testid="req-narration"
            onChange={(e) => onChange({ narration: e.target.value })} />
        </FormField>
      </div>
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
