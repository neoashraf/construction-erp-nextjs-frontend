"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { linesFilterSchema, type LinesFilterFormValues } from "../schemas/lines-filter.schema";
import { VOUCHER_TYPES, voucherTypeLabel } from "../types";

/**
 * Account-ledger / drill-down filter bar (spec §4/§7/§9; design file filter card). A
 * QUERY form, not a writing form. The Account selector (required for running balance)
 * + Date from/to + Voucher type sit on the primary row; the four dimension pickers +
 * Party sit behind a "Filters" disclosure. Client `dateFrom > dateTo` validation
 * fires inline before the query. Uniform field states via the shared primitives.
 * Apply is disabled offline (spec §6).
 *
 * Master-data comboboxes (account/party/dimension name pickers) are owned by the MAS
 * feature; to respect the import boundary this bar takes IDs directly (the drill-in
 * entry point — Trial-balance drill / a dimension picker — supplies them).
 */

export const EMPTY_LINES_FILTER: LinesFilterFormValues = {
  accountId: "",
  dateFrom: "",
  dateTo: "",
  voucherType: "",
  projectId: "",
  costCentreId: "",
  purposeId: "",
  godownId: "",
  partyId: "",
};

const DIMENSION_FIELDS: { name: keyof LinesFilterFormValues; label: string }[] = [
  { name: "projectId", label: "Project" },
  { name: "costCentreId", label: "Cost centre" },
  { name: "purposeId", label: "Purpose" },
  { name: "godownId", label: "Godown" },
  { name: "partyId", label: "Party" },
];

export function LedgerFilterBar({
  defaults,
  offline,
  onApply,
  onClear,
}: {
  defaults: LinesFilterFormValues;
  offline: boolean;
  onApply: (values: LinesFilterFormValues) => void;
  onClear: () => void;
}) {
  const [showMore, setShowMore] = useState(
    DIMENSION_FIELDS.some((f) => !!defaults[f.name]),
  );
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<LinesFilterFormValues>({
    resolver: zodResolver(linesFilterSchema),
    defaultValues: defaults,
  });

  const activeDimensions = DIMENSION_FIELDS.filter((f) => !!watch(f.name)).length;

  function clearAll() {
    reset(EMPTY_LINES_FILTER);
    onClear();
  }

  return (
    <Card className="p-4">
      <form
        onSubmit={handleSubmit(onApply)}
        noValidate
        data-testid="ledger-filter-bar"
        aria-label="Filter account ledger"
      >
        <div className="flex flex-wrap items-end gap-3">
          {/* account (required for running balance) */}
          <div className="flex min-w-[200px] flex-[1.8] flex-col gap-1.5">
            <Label htmlFor="filter-account">
              Account <span className="text-destructive">*</span>
            </Label>
            <Input
              id="filter-account"
              className="font-mono"
              placeholder="Select an account…"
              aria-describedby="filter-account-help"
              {...register("accountId")}
            />
          </div>

          {/* date from */}
          <div className="flex min-w-[130px] flex-col gap-1.5">
            <Label htmlFor="filter-date-from">Date from</Label>
            <Input
              id="filter-date-from"
              type="date"
              className="tabular-nums"
              invalid={!!errors.dateFrom}
              aria-describedby={errors.dateFrom ? "filter-date-error" : undefined}
              {...register("dateFrom")}
            />
          </div>

          {/* date to */}
          <div className="flex min-w-[130px] flex-col gap-1.5">
            <Label htmlFor="filter-date-to">Date to</Label>
            <Input
              id="filter-date-to"
              type="date"
              className="tabular-nums"
              invalid={!!errors.dateFrom}
              {...register("dateTo")}
            />
          </div>

          {/* voucher type */}
          <div className="flex min-w-[140px] flex-col gap-1.5">
            <Label htmlFor="filter-voucher-type">Voucher type</Label>
            <Select id="filter-voucher-type" {...register("voucherType")}>
              <option value="">All types</option>
              {VOUCHER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {voucherTypeLabel(t)}
                </option>
              ))}
            </Select>
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
              data-testid="ledger-filters-toggle"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Filters
              {activeDimensions > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent-soft px-1 text-[10px] font-bold text-accent-ink">
                  {activeDimensions}
                </span>
              )}
            </Button>
            <Button type="submit" size="md" disabled={offline} data-testid="ledger-apply">
              Apply
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={clearAll} data-testid="ledger-clear">
              Clear filters
            </Button>
          </div>
        </div>

        <p id="filter-account-help" className="mt-2 text-[11.5px] text-faint">
          Pick an account and a date range for a running-balance ledger; leave the account
          empty to drill down by dimension.
        </p>

        {errors.dateFrom && (
          <p
            id="filter-date-error"
            className="mt-1 text-[11.5px] text-destructive-ink"
            data-testid="ledger-date-error"
          >
            {errors.dateFrom.message}
          </p>
        )}

        {/* dimension / party disclosure */}
        {showMore && (
          <div
            className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-3 lg:grid-cols-5"
            data-testid="ledger-dimension-filters"
          >
            {DIMENSION_FIELDS.map((f) => (
              <div key={f.name} className="flex flex-col gap-1.5">
                <Label htmlFor={`filter-${f.name}`}>{f.label}</Label>
                <Input
                  id={`filter-${f.name}`}
                  className="font-mono"
                  placeholder={`${f.label} id…`}
                  {...register(f.name)}
                />
              </div>
            ))}
          </div>
        )}
      </form>
    </Card>
  );
}
