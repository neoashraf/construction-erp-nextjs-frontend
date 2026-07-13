"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DatePickerInput } from "@/components/ui/date-picker";
import { Alert } from "@/components/ui/alert";
import { formatDate, parseDate } from "@/lib/format";
import { generateSheetSchema, type GenerateSheetValues } from "../schemas/salary.schema";
import { type FinancialYearOption, type GenerateSheetInput } from "../api/salary";
import { type ProjectOption } from "../types";

/**
 * Generate dialog (spec §7; FR-HR-013). Financial year + period label + start/end + optional
 * project scope. Server-confirmed — the dialog does NOT compute gross itself; on 201 the
 * caller opens the editor with the DRAFT id. `DUPLICATE_DRAFT_SHEET` surfaces the exact
 * spec §8 copy with a direct link to the existing draft (via `existingDraftId`).
 *
 * Localization: dates render `DD/MM/YYYY` in the field; we serialise them to the API as
 * `YYYY-MM-DD` on submit.
 */
function toApiDate(uiDate: string): string {
  try {
    const d = parseDate(uiDate);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export function GenerateSheetDialog({
  open,
  onOpenChange,
  financialYears,
  projects,
  onGenerate,
  isGenerating,
  errorMessage,
  existingDraftId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  financialYears: FinancialYearOption[];
  projects: ProjectOption[];
  onGenerate: (input: GenerateSheetInput) => void;
  isGenerating: boolean;
  errorMessage?: string | null;
  /** When `DUPLICATE_DRAFT_SHEET` was surfaced, the id of the existing draft (for the link). */
  existingDraftId?: string | null;
}) {
  const [values, setValues] = useState<GenerateSheetValues>({
    financialYearId: financialYears[0]?.id ?? "",
    periodLabel: "",
    periodStart: "",
    periodEnd: "",
    projectId: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof GenerateSheetValues, string>>>({});

  useEffect(() => {
    if (open) {
      const today = new Date();
      const firstOfMonth = formatDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
      const lastOfMonth = formatDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)));
      setValues({
        financialYearId: financialYears[0]?.id ?? "",
        periodLabel: `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`,
        periodStart: firstOfMonth,
        periodEnd: lastOfMonth,
        projectId: "",
      });
      setErrors({});
    }
  }, [open, financialYears]);

  function submit() {
    const apiStart = toApiDate(values.periodStart);
    const apiEnd = toApiDate(values.periodEnd);
    const parsed = generateSheetSchema.safeParse({
      ...values,
      periodStart: apiStart,
      periodEnd: apiEnd,
    });
    if (!parsed.success) {
      const errs: typeof errors = {};
      for (const iss of parsed.error.issues) {
        const p = iss.path[0] as keyof GenerateSheetValues | undefined;
        if (p) errs[p] = iss.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    onGenerate({
      financialYearId: parsed.data.financialYearId,
      periodLabel: parsed.data.periodLabel,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      projectId: parsed.data.projectId || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!isGenerating ? onOpenChange(v) : undefined)}>
      <DialogContent data-testid="generate-sheet-dialog" className="max-w-[520px]">
        <DialogTitle>Generate salary sheet</DialogTitle>
        <DialogDescription>
          This calculates gross pay from attendance, wage type, and overtime for every active employee.
          Inactive employees are excluded automatically.
        </DialogDescription>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="col-span-1">
            <Label htmlFor="gen-fy" className="mb-1 block text-[12px] font-semibold text-foreground">
              Financial year <span className="text-destructive">*</span>
            </Label>
            <Select
              id="gen-fy"
              data-testid="gen-fy"
              value={values.financialYearId}
              onChange={(e) => setValues((v) => ({ ...v, financialYearId: e.target.value }))}
              invalid={!!errors.financialYearId}
            >
              <option value="">Choose a year…</option>
              {financialYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.code}
                </option>
              ))}
            </Select>
            {errors.financialYearId && (
              <p className="mt-1 text-[12px] text-destructive" data-testid="gen-fy-err">
                {errors.financialYearId}
              </p>
            )}
          </div>
          <div className="col-span-1">
            <Label htmlFor="gen-period" className="mb-1 block text-[12px] font-semibold text-foreground">
              Period label <span className="text-destructive">*</span>
            </Label>
            <Input
              id="gen-period"
              data-testid="gen-period"
              placeholder="e.g. 2026-06"
              value={values.periodLabel}
              onChange={(e) => setValues((v) => ({ ...v, periodLabel: e.target.value }))}
              invalid={!!errors.periodLabel}
            />
            {errors.periodLabel && (
              <p className="mt-1 text-[12px] text-destructive" data-testid="gen-period-err">
                {errors.periodLabel}
              </p>
            )}
          </div>
          <div className="col-span-1">
            <Label htmlFor="gen-start" className="mb-1 block text-[12px] font-semibold text-foreground">
              Start date <span className="text-destructive">*</span>
            </Label>
            <DatePickerInput
              id="gen-start"
              value={values.periodStart}
              onChange={(v) => setValues((s) => ({ ...s, periodStart: v }))}
              invalid={!!errors.periodStart}
            />
            {errors.periodStart && (
              <p className="mt-1 text-[12px] text-destructive" data-testid="gen-start-err">
                {errors.periodStart}
              </p>
            )}
          </div>
          <div className="col-span-1">
            <Label htmlFor="gen-end" className="mb-1 block text-[12px] font-semibold text-foreground">
              End date <span className="text-destructive">*</span>
            </Label>
            <DatePickerInput
              id="gen-end"
              value={values.periodEnd}
              onChange={(v) => setValues((s) => ({ ...s, periodEnd: v }))}
              invalid={!!errors.periodEnd}
            />
            {errors.periodEnd && (
              <p className="mt-1 text-[12px] text-destructive" data-testid="gen-end-err">
                {errors.periodEnd}
              </p>
            )}
          </div>
          <div className="col-span-2">
            <Label htmlFor="gen-project" className="mb-1 block text-[12px] font-semibold text-foreground">
              Project (optional scope)
            </Label>
            <Select
              id="gen-project"
              data-testid="gen-project"
              value={values.projectId ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, projectId: e.target.value }))}
            >
              <option value="">All projects (unscoped)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {errorMessage && (
          <Alert tone="destructive" className="mt-4" title={errorMessage} data-testid="gen-server-err">
            {existingDraftId && (
              <Link
                href={`/hr/salary-sheets/${existingDraftId}`}
                className="mt-1 inline-block text-[12px] font-semibold underline underline-offset-2"
                data-testid="gen-existing-link"
              >
                Open existing draft
              </Link>
            )}
          </Alert>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating} data-testid="gen-cancel">
            Cancel
          </Button>
          <Button onClick={submit} disabled={isGenerating} data-testid="gen-submit" aria-busy={isGenerating || undefined}>
            {isGenerating ? "Generating…" : "Generate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
