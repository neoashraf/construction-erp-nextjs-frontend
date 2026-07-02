"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useCompanyFy } from "@/providers/company-fy-provider";
import { useShellMasters } from "@/lib/shell/shell-data";
import { cn } from "@/lib/utils";

/**
 * Company · FY switcher chip + popover (screen spec §5/§7/§9/§13). The chip shows the
 * **resolved** company name · FY label (from `GET /api/masters/companies` +
 * `/financial-years`), falling back to short IDs with a "Names unavailable" tooltip if
 * the masters call fails (spec §6 partial). The popover: company select rendered
 * read-only (single-company Phase 1, tooltip "Single-company setup"); FY select
 * (active FY pre-selected); Switch applies + re-scopes all queries and toasts. On
 * unsaved changes the caller-supplied guard prompts first (§9).
 */
export function CompanyFySwitcher({
  hasUnsavedChanges = () => false,
}: {
  hasUnsavedChanges?: () => boolean;
}) {
  const { companyId, financialYearId, companyName, financialYearLabel, setResolvedNames, switchFinancialYear } =
    useCompanyFy();
  const { toast } = useToast();
  const masters = useShellMasters(companyId);

  const [open, setOpen] = useState(false);
  const [draftFy, setDraftFy] = useState(financialYearId);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Push resolved names up to the provider (chip + sidebar footer read them there).
  useEffect(() => {
    if (masters.data) {
      const active =
        masters.data.financialYears.find((f) => f.id === financialYearId) ??
        masters.data.financialYears.find((f) => f.isActive) ??
        null;
      setResolvedNames({
        companyName: masters.data.company?.name ?? null,
        financialYearLabel: active?.label ?? null,
      });
    }
  }, [masters.data, financialYearId, setResolvedNames]);

  // Keep the draft in sync with the live FY whenever the popover (re)opens.
  useEffect(() => {
    if (open) setDraftFy(financialYearId);
  }, [open, financialYearId]);

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const namesUnavailable = masters.isError;
  const companyText = companyName ?? (namesUnavailable ? `Co ${companyId.slice(0, 8)}` : companyName ?? `Co ${companyId.slice(0, 8)}`);
  const fyText = financialYearLabel ?? `FY ${financialYearId.slice(0, 8)}`;

  const fyOptions = masters.data?.financialYears ?? [];
  const dirty = draftFy !== financialYearId;

  function apply() {
    if (!draftFy || !dirty) return;
    if (hasUnsavedChanges() && !window.confirm("Switch financial year? Unsaved changes will be lost.")) {
      return;
    }
    const chosen = fyOptions.find((f) => f.id === draftFy);
    const label = chosen?.label ?? null;
    switchFinancialYear(draftFy, label);
    toast(`Financial year switched to ${label ?? "the selected year"}.`, "success");
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        data-testid="company-fy"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={namesUnavailable ? "Names unavailable" : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[280px] items-center gap-2 rounded-token border border-border-strong bg-surface px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
      >
        <span className="truncate font-semibold text-foreground">{companyText}</span>
        <span className="text-faint" aria-hidden>
          ·
        </span>
        <span className="truncate">{fyText}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Working context"
          data-testid="company-fy-popover"
          className="absolute left-0 top-full z-50 mt-2 w-[300px] rounded-lg border border-border-strong bg-surface p-4 shadow-lg"
        >
          <div className="text-[13px] font-semibold text-foreground">Working context</div>

          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Company
          </label>
          <div className="mt-1" title="Single-company setup">
            <Select value={companyId} disabled aria-label="Company (single-company setup)">
              <option value={companyId}>{companyName ?? "This company"}</option>
            </Select>
          </div>

          <label
            htmlFor="switcher-fy"
            className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Financial year
          </label>
          <div className="mt-1">
            <Select
              id="switcher-fy"
              value={draftFy}
              onChange={(e) => setDraftFy(e.target.value)}
              disabled={masters.isLoading || fyOptions.length === 0}
              data-testid="switcher-fy-select"
            >
              {fyOptions.length === 0 ? (
                <option value={financialYearId}>{fyText}</option>
              ) : (
                fyOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                    {f.isActive ? " (active)" : ""}
                  </option>
                ))
              )}
            </Select>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
            Default year for new vouchers. The voucher&apos;s own date decides its posting year.
          </p>

          <div className={cn("mt-4 flex justify-end gap-2")}>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={apply} disabled={!dirty} data-testid="switcher-apply">
              Switch
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
