"use client";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerInput } from "@/components/ui/date-picker";
import { PoPicker } from "./PoPicker";
import { type GrnFormValues } from "../schemas/grn.schema";
import { type ProjectOption, type PurchaseBillSummary, type SupplierOption } from "../types";

export interface GrnHeaderErrors {
  projectId?: string;
  supplierId?: string;
  purchaseOrderId?: string;
  purchaseBillId?: string;
  receiptDate?: string;
  narration?: string;
}

/**
 * GRN entry header (brief §Scope 3; spec §5). The Store Keeper picks a reference —
 * PO and/or Bill (one required) — from which lines pre-fill; project + supplier
 * inherit from the picked reference and render read-only. Receipt date defaults
 * today; narration is an optional Bangla-safe discrepancy note. Every input uses
 * the shared design-system field states (focus + error) via `components/ui/*`.
 */
export function GrnHeaderFields({
  values,
  errors,
  disabled,
  projects,
  suppliers,
  bills,
  onChange,
}: {
  values: GrnFormValues;
  errors: GrnHeaderErrors;
  disabled: boolean;
  projects: ProjectOption[];
  suppliers: SupplierOption[];
  bills: PurchaseBillSummary[];
  onChange: (patch: Partial<GrnFormValues>) => void;
}) {
  const project = projects.find((p) => p.id === values.projectId);
  const projectLabel = project
    ? project.projectCode
      ? `${project.projectCode} — ${project.name}`
      : project.name
    : "";
  const supplier = suppliers.find((s) => s.id === values.supplierId);
  const supplierLabel = supplier?.name ?? "";

  const eligibleBills = bills.filter(
    (b) =>
      b.status === "POSTED" &&
      (!values.projectId || b.projectId === values.projectId) &&
      (!values.supplierId || b.supplierId === values.supplierId),
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <Label htmlFor="grn-po">PO reference</Label>
        <PoPicker
          id="grn-po"
          value={values.purchaseOrderId}
          onChange={(id) => onChange({ purchaseOrderId: id, purchaseBillId: "" })}
          projectId={values.projectId || undefined}
          supplierId={values.supplierId || undefined}
          disabled={disabled}
          invalid={!!errors.purchaseOrderId}
          placeholder="Select a purchase order…"
        />
        {errors.purchaseOrderId && (
          <p className="mt-1 text-[12px] text-destructive-ink" data-testid="grn-po-error">
            {errors.purchaseOrderId}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="grn-bill">Bill reference</Label>
        <Select
          id="grn-bill"
          value={values.purchaseBillId}
          disabled={disabled}
          invalid={!!errors.purchaseBillId}
          onChange={(e) => onChange({ purchaseBillId: e.target.value, purchaseOrderId: "" })}
          data-testid="grn-bill"
        >
          <option value="">Select a bill…</option>
          {eligibleBills.map((b) => (
            <option key={b.id} value={b.id}>
              {b.entryNo ?? "Draft"} · {b.billDate}
            </option>
          ))}
        </Select>
        {errors.purchaseBillId && (
          <p className="mt-1 text-[12px] text-destructive-ink" data-testid="grn-bill-error">
            {errors.purchaseBillId}
          </p>
        )}
      </div>

      <div>
        <Label>Project</Label>
        <div
          className="flex h-9 items-center rounded-token border border-border bg-muted px-3 text-sm text-foreground"
          data-testid="grn-project"
        >
          {projectLabel || <span className="text-faint">Inherits from PO/Bill</span>}
        </div>
      </div>

      <div>
        <Label>Supplier</Label>
        <div
          className="flex h-9 items-center rounded-token border border-border bg-muted px-3 text-sm text-foreground"
          data-testid="grn-supplier"
        >
          {supplierLabel || <span className="text-faint">Inherits from PO/Bill</span>}
        </div>
      </div>

      <div>
        <Label htmlFor="grn-date">Receipt date</Label>
        <DatePickerInput
          id="grn-date"
          value={values.receiptDate}
          onChange={(v) => onChange({ receiptDate: v })}
          disabled={disabled}
          invalid={!!errors.receiptDate}
        />
        {errors.receiptDate && (
          <p className="mt-1 text-[12px] text-destructive-ink" data-testid="grn-date-error">
            {errors.receiptDate}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="grn-narration">Narration (optional)</Label>
        <Textarea
          id="grn-narration"
          value={values.narration}
          disabled={disabled}
          onChange={(e) => onChange({ narration: e.target.value })}
          placeholder="e.g. 10 bags short — supplier will re-deliver"
          rows={2}
          data-testid="grn-narration"
        />
      </div>
    </div>
  );
}
