"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type BulkField = "allowances" | "tds" | "pf" | "advanceRecovery";

const FIELD_META: Record<BulkField, { label: string; valLabel: string; placeholder: string }> = {
  allowances: { label: "Allowances (flat ৳)", valLabel: "Amount ৳", placeholder: "e.g. 3000" },
  tds: { label: "TDS (rate %)", valLabel: "Rate %", placeholder: "e.g. 5" },
  pf: { label: "PF (flat ৳)", valLabel: "Amount ৳", placeholder: "e.g. 2200" },
  advanceRecovery: { label: "Advance recovery (flat ৳)", valLabel: "Amount ৳", placeholder: "e.g. 2000" },
};

const SCOPES = [
  { id: "all", label: "All employees" },
  { id: "Bridge-04 — Buriganga", label: "Bridge-04 — Buriganga" },
  { id: "Tower-A", label: "Tower-A" },
];

/**
 * Bulk-apply a component across DRAFT lines (FR-HR-014; Salary Sheet.dc.html). Set a
 * flat allowance / PF / advance, or a TDS rate, across a scope of lines. The parent
 * owns the line edits — this only collects the component, value, and scope.
 */
export function SalaryBulkApply({
  onApply,
}: {
  onApply: (field: BulkField, value: string, scope: string) => void;
}) {
  const [field, setField] = useState<BulkField>("allowances");
  const [value, setValue] = useState("");
  const [scope, setScope] = useState("all");
  const meta = FIELD_META[field];

  return (
    <Card className="p-[18px]">
      <div className="text-[13px] font-semibold text-foreground">
        Apply a component to multiple lines
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Set a flat allowance / PF / advance, or a TDS rate, across a group of lines.
      </p>

      <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label className="mb-1.5 block text-[11px]">Component</Label>
          <Select value={field} onChange={(e) => setField(e.target.value as BulkField)}>
            {(Object.keys(FIELD_META) as BulkField[]).map((f) => (
              <option key={f} value={f}>
                {FIELD_META[f].label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-[11px]">{meta.valLabel}</Label>
          <Input
            className="font-mono"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder={meta.placeholder}
            inputMode="decimal"
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-[11px]">Scope</Label>
          <Select value={scope} onChange={(e) => setScope(e.target.value)}>
            {SCOPES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <span className="text-[12px] text-faint">
          Applies the component across the chosen scope.
        </span>
        <Button size="sm" className="h-9 px-4" onClick={() => onApply(field, value, scope)}>
          Apply to all
        </Button>
      </div>
    </Card>
  );
}
