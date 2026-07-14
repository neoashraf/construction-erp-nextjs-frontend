"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { bulkComponentSchema } from "../schemas/salary.schema";
import { type BulkComponentInput, type SalarySheetLine } from "../api/salary";

/**
 * Bulk-component panel (spec §5/§7; FR-HR-014). DRAFT-only: apply a flat allowance /
 * TDS rate (%) / PF / advance recovery across all lines or a scoped subset. Always
 * previews `{changedLineCount}` before committing (protects against sheet-wide overwrite).
 * `tdsRate` is a percent 0..100; the server converts to per-line amounts.
 */
export function BulkComponentPanel({
  lines,
  sheetVersion,
  disabled,
  onApply,
  isApplying,
  serverError,
}: {
  lines: SalarySheetLine[];
  sheetVersion: number;
  disabled: boolean;
  onApply: (input: BulkComponentInput) => void;
  isApplying: boolean;
  serverError?: string | null;
}) {
  const [allowances, setAllowances] = useState("");
  const [tdsRate, setTdsRate] = useState("");
  const [pfAmount, setPfAmount] = useState("");
  const [advanceRecovery, setAdvanceRecovery] = useState("");
  const [scopeAll, setScopeAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const willChange = useMemo(() => (scopeAll ? lines.length : selectedIds.length), [scopeAll, selectedIds, lines.length]);

  function toggleEmployee(id: string) {
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function submit() {
    const parsed = bulkComponentSchema.safeParse({
      allowances: allowances || "",
      tdsRate: tdsRate || "",
      pfAmount: pfAmount || "",
      advanceRecovery: advanceRecovery || "",
      employeeIds: scopeAll ? null : selectedIds,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter at least one value to apply.");
      return;
    }
    if (!scopeAll && selectedIds.length === 0) {
      setError("Choose at least one employee, or apply to all.");
      return;
    }
    setError(null);
    const apply: BulkComponentInput["apply"] = {};
    if (allowances) apply.allowances = allowances;
    if (tdsRate) apply.tdsRate = tdsRate;
    if (pfAmount) apply.pfAmount = pfAmount;
    if (advanceRecovery) apply.advanceRecovery = advanceRecovery;
    onApply({ apply, employeeIds: scopeAll ? null : selectedIds, version: sheetVersion });
  }

  if (disabled) return null;

  return (
    <Card className="p-4" data-testid="bulk-component-panel">
      <div className="mb-3">
        <h2 className="text-[13.5px] font-bold text-foreground">Apply a component to multiple lines</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Set a flat allowance / PF / advance, or a TDS rate, across a group of lines.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Allowances ৳" id="bulk-allow" value={allowances} onChange={setAllowances} testId="bulk-allow" />
        <Field label="TDS rate %" id="bulk-tds" value={tdsRate} onChange={setTdsRate} testId="bulk-tds" />
        <Field label="PF ৳" id="bulk-pf" value={pfAmount} onChange={setPfAmount} testId="bulk-pf" />
        <Field label="Advance recovery ৳" id="bulk-adv" value={advanceRecovery} onChange={setAdvanceRecovery} testId="bulk-adv" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-[12.5px] text-foreground">
          <Checkbox
            checked={scopeAll}
            onChange={(e) => setScopeAll(e.target.checked)}
            data-testid="bulk-scope-all"
          />
          Apply to all lines
        </label>
        {!scopeAll && (
          <details className="text-[12px]">
            <summary className="cursor-pointer text-accent-ink">Choose employees…</summary>
            <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-card border border-border p-2">
              {lines.map((l) => (
                <label key={l.id} className="inline-flex items-center gap-1.5" data-testid={`bulk-emp-${l.employeeId}`}>
                  <Checkbox
                    checked={selectedIds.includes(l.employeeId)}
                    onChange={() => toggleEmployee(l.employeeId)}
                  />
                  <span>{l.employeeName}</span>
                </label>
              ))}
            </div>
          </details>
        )}
      </div>

      {error && (
        <p className="mt-3 text-[12px] text-destructive" data-testid="bulk-err">
          {error}
        </p>
      )}
      {serverError && <Alert tone="destructive" className="mt-3" title={serverError} data-testid="bulk-server-err" />}

      <div className="mt-3.5 flex items-center gap-3">
        <span className="text-[12px] text-muted-foreground" data-testid="bulk-will-change">
          Will change <b className="font-semibold text-foreground">{willChange}</b> of {lines.length} line
          {lines.length === 1 ? "" : "s"}.
        </span>
        <div className="flex-1" />
        <Button onClick={submit} disabled={isApplying} data-testid="bulk-apply">
          {isApplying ? "Applying…" : "Apply to selected"}
        </Button>
      </div>
    </Card>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  testId,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        data-testid={testId}
        className="text-right font-mono tabular-nums"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
    </div>
  );
}
