"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  trialBalanceFilterSchema,
  GROUP_BY_OPTIONS,
  GROUP_BY_LABEL,
  type GroupByOption,
  type TrialBalanceFilterFormValues,
} from "../schemas/trial-balance-filter.schema";

/**
 * Trial-balance filter bar (spec §4/§7/§9; design file filter card). A QUERY form,
 * not a writing form: FY / Period (as-of) / Date-from-to / Group-by chips /
 * Include-reversals sit on the primary row; the dimension + party pickers sit behind
 * a "Filters" disclosure (mirrors `LedgerFilterBar`). Apply fires only on submit — no
 * auto-fetch, since this is a heavy aggregation (spec §9). Selecting a Period visually
 * disables/dims the date-range inputs with the "Ignored when a period is selected"
 * helper; clearing the period re-enables them (server: `periodId` wins). Client
 * `dateFrom > dateTo` validation is skipped once a period is set (schema §refine).
 * Uniform field states via the shared Input/Select/Checkbox primitives. Apply is
 * disabled offline (spec §6).
 *
 * Master-data comboboxes (FY/period/account/party/dimension name pickers) are owned
 * by the MAS feature; to respect the import boundary this bar takes IDs directly via
 * plain text/id inputs (matches `LedgerFilterBar`'s established pattern).
 */

export const EMPTY_TRIAL_BALANCE_FILTER: TrialBalanceFilterFormValues = {
  financialYearId: "",
  periodId: "",
  dateFrom: "",
  dateTo: "",
  groupBy: ["account"],
  projectId: "",
  costCentreId: "",
  purposeId: "",
  godownId: "",
  partyId: "",
  accountId: "",
  includeReversals: true,
};

const DIMENSION_FIELDS: { name: keyof TrialBalanceFilterFormValues; label: string }[] = [
  { name: "projectId", label: "Project" },
  { name: "costCentreId", label: "Cost centre" },
  { name: "purposeId", label: "Purpose" },
  { name: "godownId", label: "Godown" },
  { name: "partyId", label: "Party" },
  { name: "accountId", label: "Account" },
];

export function TrialBalanceFilterBar({
  defaults,
  activeFyId,
  offline,
  projectScopeError,
  onApply,
  onClear,
}: {
  defaults: TrialBalanceFilterFormValues;
  activeFyId: string;
  offline: boolean;
  /** Inline copy shown near the filter bar when a PM filters an unassigned project (spec §11). */
  projectScopeError?: string | null;
  onApply: (values: TrialBalanceFilterFormValues) => void;
  onClear: () => void;
}) {
  const [showMore, setShowMore] = useState(
    DIMENSION_FIELDS.some((f) => !!defaults[f.name]),
  );
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<TrialBalanceFilterFormValues>({
    resolver: zodResolver(trialBalanceFilterSchema),
    defaultValues: defaults,
  });

  const periodId = watch("periodId");
  const periodSelected = !!periodId;
  const activeDimensions = DIMENSION_FIELDS.filter((f) => !!watch(f.name)).length;

  function clearAll() {
    const reset_ = { ...EMPTY_TRIAL_BALANCE_FILTER, financialYearId: activeFyId };
    reset(reset_);
    onClear();
  }

  return (
    <Card className="p-4">
      <form
        onSubmit={handleSubmit(onApply)}
        noValidate
        data-testid="trial-balance-filter-bar"
        aria-label="Filter trial balance"
      >
        <div className="flex flex-wrap items-end gap-3">
          {/* financial year */}
          <div className="flex min-w-[150px] flex-1 flex-col gap-1.5">
            <Label htmlFor="tb-filter-fy">Financial year</Label>
            <Input
              id="tb-filter-fy"
              placeholder="Active FY"
              aria-describedby="tb-filter-fy-help"
              {...register("financialYearId")}
            />
          </div>

          {/* period (as-of) */}
          <div className="flex min-w-[150px] flex-col gap-1.5">
            <Label htmlFor="tb-filter-period">
              Period <span className="font-normal normal-case tracking-normal text-faint">· as-of</span>
            </Label>
            <Input
              id="tb-filter-period"
              placeholder="None"
              data-testid="tb-filter-period"
              {...register("periodId")}
            />
          </div>

          {/* date from */}
          <div className="flex min-w-[130px] flex-col gap-1.5" style={{ opacity: periodSelected ? 0.5 : 1 }}>
            <Label htmlFor="tb-filter-date-from">Date from</Label>
            <Input
              id="tb-filter-date-from"
              type="date"
              className="tabular-nums"
              disabled={periodSelected}
              invalid={!!errors.dateFrom}
              aria-describedby={errors.dateFrom ? "tb-filter-date-error" : "tb-filter-period-helper"}
              data-testid="tb-filter-date-from"
              {...register("dateFrom")}
            />
          </div>

          {/* date to */}
          <div className="flex min-w-[130px] flex-col gap-1.5" style={{ opacity: periodSelected ? 0.5 : 1 }}>
            <Label htmlFor="tb-filter-date-to">Date to</Label>
            <Input
              id="tb-filter-date-to"
              type="date"
              className="tabular-nums"
              disabled={periodSelected}
              invalid={!!errors.dateFrom}
              data-testid="tb-filter-date-to"
              {...register("dateTo")}
            />
          </div>

          {/* group by (multi-select chips) */}
          <div className="flex min-w-[220px] flex-col gap-1.5">
            <Label id="tb-filter-groupby-label">Group by</Label>
            <Controller
              name="groupBy"
              control={control}
              render={({ field }) => (
                <div
                  role="group"
                  aria-labelledby="tb-filter-groupby-label"
                  className="flex flex-wrap gap-1.5"
                  data-testid="tb-filter-groupby"
                >
                  {GROUP_BY_OPTIONS.map((opt) => {
                    const checked = field.value.includes(opt);
                    return (
                      <GroupByChip
                        key={opt}
                        option={opt}
                        checked={checked}
                        onToggle={() => {
                          const next: GroupByOption[] = checked
                            ? field.value.filter((v) => v !== opt)
                            : [...field.value, opt];
                          field.onChange(next);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            />
          </div>

          {/* include reversals */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tb-filter-include-reversals">Include reversals</Label>
            <label className="flex h-9 cursor-pointer items-center gap-2">
              <Checkbox id="tb-filter-include-reversals" {...register("includeReversals")} />
              <span className="text-xs text-muted-foreground">Reversal entries net out naturally</span>
            </label>
          </div>

          {/* actions */}
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="gap-1.5"
              aria-expanded={showMore}
              onClick={() => setShowMore((s) => !s)}
              data-testid="tb-filters-toggle"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Filters
              {activeDimensions > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent-soft px-1 text-[10px] font-bold text-accent-ink">
                  {activeDimensions}
                </span>
              )}
            </Button>
            <Button type="submit" size="md" disabled={offline} data-testid="tb-apply">
              Apply
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={clearAll} data-testid="tb-clear">
              Clear filters
            </Button>
          </div>
        </div>

        <p id="tb-filter-fy-help" className="sr-only">
          Scope of the trial balance.
        </p>

        {errors.dateFrom && (
          <p
            id="tb-filter-date-error"
            className="mt-2 text-[11.5px] text-destructive-ink"
            data-testid="tb-date-error"
          >
            {errors.dateFrom.message}
          </p>
        )}

        {periodSelected && (
          <p
            id="tb-filter-period-helper"
            className="mt-2 flex items-center gap-1.5 border-t border-muted pt-2 text-[12px] text-muted-foreground"
            data-testid="tb-period-helper"
          >
            A period is selected, so the date range is{" "}
            <span className="font-medium text-foreground">Ignored when a period is selected</span>.
          </p>
        )}

        {projectScopeError && (
          <p className="mt-2 text-[11.5px] text-destructive-ink" data-testid="tb-project-scope-error">
            {projectScopeError}
          </p>
        )}

        {/* dimension / party disclosure */}
        {showMore && (
          <div
            className={cn(
              "mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-3 lg:grid-cols-6",
            )}
            data-testid="tb-dimension-filters"
          >
            {DIMENSION_FIELDS.map((f) => (
              <div key={f.name} className="flex flex-col gap-1.5">
                <Label htmlFor={`tb-filter-${f.name}`}>{f.label}</Label>
                <Input
                  id={`tb-filter-${f.name}`}
                  className="font-mono"
                  placeholder={`${f.label} id…`}
                  {...register(f.name as "projectId")}
                />
              </div>
            ))}
          </div>
        )}
      </form>
    </Card>
  );
}

function GroupByChip({
  option,
  checked,
  onToggle,
}: {
  option: GroupByOption;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      data-testid={`tb-groupby-${option}`}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-xs font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:shadow-focus",
        checked
          ? "border-accent-soft bg-accent-soft text-accent-ink"
          : "border-border-strong bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {GROUP_BY_LABEL[option]}
    </button>
  );
}
