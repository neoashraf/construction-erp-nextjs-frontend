"use client";

import { useState } from "react";
import { Lock, Home, User, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/money-input";
import { DatePickerInput } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type FieldErrors, type IpcFormValues } from "../schemas/ipc.schema";
import { type CostCentreOption, type ProjectOption, type PurposeOption } from "../types";

/** One labelled field with an optional inline error (shared focus/error states via the primitives). */
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
      <label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
        {hint && <span className="ml-1 font-normal normal-case tracking-normal text-faint">· {hint}</span>}
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

/**
 * IPC certificate-detail capture fields (spec §4/§7; design "Certificate details"). Project
 * picker resolves + displays the read-only customer (FR-SAL-001); sequence no · IPC/bill/due
 * dates · work % · certified amount (the VAT base) · cost centre · purpose (project-scoped,
 * inline-create) · narration. Every input shares the design-system focus/error states. Fully
 * read-only once POSTED/CANCELLED (`readOnly`) — FR-SAL-023.
 */
export function IpcCaptureFields({
  values,
  errors,
  projects,
  costCentres,
  purposes,
  purposesLoading,
  customerName,
  readOnly,
  onChange,
  onAddPurpose,
}: {
  values: IpcFormValues;
  errors: FieldErrors;
  projects: ProjectOption[];
  costCentres: CostCentreOption[];
  purposes: PurposeOption[];
  purposesLoading: boolean;
  customerName: string;
  readOnly: boolean;
  onChange: (patch: Partial<IpcFormValues>) => void;
  onAddPurpose: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newPurpose, setNewPurpose] = useState("");

  return (
    <div className="flex flex-col gap-4">
      {/* Project → resolved customer */}
      <Field label="Project" htmlFor="ipc-project" required error={errors.projectId}>
        <div className="relative">
          <Home className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Select
            id="ipc-project"
            className="pl-9"
            value={values.projectId}
            invalid={!!errors.projectId}
            disabled={readOnly}
            data-testid="ipc-project"
            onChange={(e) => onChange({ projectId: e.target.value })}
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}</option>
            ))}
          </Select>
        </div>
      </Field>

      <Field label="Customer" hint="resolved from project, read-only">
        <div
          className="relative flex h-9 items-center rounded-token border border-border-strong bg-muted pl-9 pr-9 text-sm text-foreground"
          aria-readonly="true"
          aria-label="Customer, resolved from the project and not editable"
          data-testid="ipc-customer"
        >
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <span className="truncate [overflow-wrap:anywhere]">{customerName || "—"}</span>
          <Lock className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" aria-hidden />
        </div>
      </Field>

      {/* Sequence + dates */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="IPC seq no" htmlFor="ipc-seq" required error={errors.ipcSeqNo}>
          <Input
            id="ipc-seq"
            inputMode="numeric"
            value={values.ipcSeqNo}
            invalid={!!errors.ipcSeqNo}
            disabled={readOnly}
            data-testid="ipc-seq"
            onChange={(e) => onChange({ ipcSeqNo: e.target.value })}
          />
        </Field>
        <Field label="IPC date" htmlFor="ipc-date" required error={errors.ipcDate}>
          <DatePickerInput id="ipc-date" value={values.ipcDate} invalid={!!errors.ipcDate} disabled={readOnly} onChange={(v) => onChange({ ipcDate: v })} />
        </Field>
        <Field label="Bill date" htmlFor="ipc-bill" required error={errors.billDate}>
          <DatePickerInput id="ipc-bill" value={values.billDate} invalid={!!errors.billDate} disabled={readOnly} onChange={(v) => onChange({ billDate: v })} />
        </Field>
        <Field label="Due date" htmlFor="ipc-due" required error={errors.dueDate}>
          <DatePickerInput id="ipc-due" value={values.dueDate} invalid={!!errors.dueDate} disabled={readOnly} align="right" onChange={(v) => onChange({ dueDate: v })} />
        </Field>
      </div>

      {/* Work % + certified */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Work completed %" htmlFor="ipc-work" required error={errors.workCompletedPct}>
          <div className="relative">
            <Input
              id="ipc-work"
              inputMode="decimal"
              className="pr-8 text-right tabular-nums"
              value={values.workCompletedPct}
              invalid={!!errors.workCompletedPct}
              disabled={readOnly}
              data-testid="ipc-work"
              onChange={(e) => onChange({ workCompletedPct: e.target.value })}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>%</span>
          </div>
        </Field>
        <Field label="Certified amount" htmlFor="ipc-certified" required hint="VAT base" error={errors.certifiedAmount}>
          <MoneyInput
            id="ipc-certified"
            value={values.certifiedAmount}
            invalid={!!errors.certifiedAmount}
            disabled={readOnly}
            data-testid="ipc-certified"
            onChange={(e) => onChange({ certifiedAmount: e.target.value })}
          />
        </Field>
      </div>

      {/* Cost centre + purpose */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cost centre" htmlFor="ipc-cc" required error={errors.costCentreId}>
          <Select
            id="ipc-cc"
            value={values.costCentreId}
            invalid={!!errors.costCentreId}
            disabled={readOnly}
            data-testid="ipc-cc"
            onChange={(e) => onChange({ costCentreId: e.target.value })}
          >
            <option value="">Select a cost centre…</option>
            {costCentres.map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Purpose" htmlFor="ipc-purpose" required error={errors.purposeId}>
          <div className="flex flex-col gap-1.5">
            <Select
              id="ipc-purpose"
              value={values.purposeId}
              invalid={!!errors.purposeId}
              disabled={readOnly || !values.projectId}
              data-testid="ipc-purpose"
              onChange={(e) => onChange({ purposeId: e.target.value })}
            >
              <option value="">{!values.projectId ? "Select a project first" : purposesLoading ? "Loading…" : "Select a purpose…"}</option>
              {purposes.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            {!readOnly && values.projectId && (
              adding ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    className="h-8 flex-1"
                    value={newPurpose}
                    placeholder="New purpose name"
                    autoFocus
                    data-testid="ipc-purpose-new"
                    onChange={(e) => setNewPurpose(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!newPurpose.trim()}
                    data-testid="ipc-purpose-add"
                    onClick={() => {
                      onAddPurpose(newPurpose.trim());
                      setNewPurpose("");
                      setAdding(false);
                    }}
                  >
                    Add
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setNewPurpose(""); }}>Cancel</Button>
                </div>
              ) : (
                <button
                  type="button"
                  className="inline-flex w-fit items-center gap-1 text-[12px] font-medium text-accent-ink hover:underline"
                  data-testid="ipc-purpose-add-toggle"
                  onClick={() => setAdding(true)}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Add purpose
                </button>
              )
            )}
          </div>
        </Field>
      </div>

      <Field label="Narration" htmlFor="ipc-narration" hint="optional">
        <Textarea
          id="ipc-narration"
          value={values.narration}
          disabled={readOnly}
          className={cn(readOnly && "opacity-100")}
          data-testid="ipc-narration"
          placeholder="Optional note for this certificate…"
          onChange={(e) => onChange({ narration: e.target.value })}
        />
      </Field>
    </div>
  );
}
