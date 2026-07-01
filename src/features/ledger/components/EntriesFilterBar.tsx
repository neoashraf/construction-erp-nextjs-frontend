"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  entriesFilterSchema,
  type EntriesFilterFormValues,
} from "../schemas/entries-filter.schema";
import { VOUCHER_TYPES, voucherTypeLabel, type ReversalFilter } from "../types";

/**
 * Journal-entries filter bar (spec §4/§7/§9; design file filter card). A QUERY form,
 * not a writing form: Entry-no search, Date from/to (client `dateFrom > dateTo`
 * validation before firing), Voucher type, FY/Period (FY-scoped display), and a
 * tri-state Reversal toggle. Apply fires the query; Clear resets to the active-FY
 * default. Uniform field states via the shared Input/Select primitives. Apply is
 * disabled offline (spec §6).
 */

const REVERSAL_OPTIONS: { key: ReversalFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "normal", label: "Normal" },
  { key: "reversal", label: "Reversal" },
];

export const EMPTY_FILTER: EntriesFilterFormValues = {
  entryNo: "",
  dateFrom: "",
  dateTo: "",
  voucherType: "",
  reversal: "all",
};

export function EntriesFilterBar({
  defaults,
  fyLabel,
  offline,
  onApply,
  onClear,
}: {
  defaults: EntriesFilterFormValues;
  fyLabel: string;
  offline: boolean;
  onApply: (values: EntriesFilterFormValues) => void;
  onClear: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EntriesFilterFormValues>({
    resolver: zodResolver(entriesFilterSchema),
    defaultValues: defaults,
  });

  function clearAll() {
    reset(EMPTY_FILTER);
    onClear();
  }

  return (
    <Card className="p-4">
      <form
        onSubmit={handleSubmit(onApply)}
        noValidate
        className="flex flex-wrap items-end gap-3"
        data-testid="entries-filter-bar"
        aria-label="Filter journal entries"
      >
        {/* entry no */}
        <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <Label htmlFor="filter-entry-no">Entry no.</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
              aria-hidden
            />
            <Input
              id="filter-entry-no"
              type="search"
              className="pl-9 font-mono"
              placeholder="Search by entry number"
              {...register("entryNo")}
            />
          </div>
        </div>

        {/* date from */}
        <div className="flex min-w-[140px] flex-col gap-1.5">
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
        <div className="flex min-w-[140px] flex-col gap-1.5">
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
        <div className="flex min-w-[150px] flex-col gap-1.5">
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

        {/* FY / period (FY-scoped display) */}
        <div className="flex min-w-[150px] flex-col gap-1.5">
          <Label htmlFor="filter-fy">FY / Period</Label>
          <Select id="filter-fy" defaultValue="active" disabled aria-readonly>
            <option value="active">{fyLabel || "Active FY"}</option>
          </Select>
        </div>

        {/* reversal tri-state */}
        <div className="flex flex-col gap-1.5">
          <Label id="filter-reversal-label">Reversal</Label>
          <div
            role="radiogroup"
            aria-labelledby="filter-reversal-label"
            className="flex gap-0.5 rounded-token bg-muted p-0.5"
          >
            {REVERSAL_OPTIONS.map((o) => (
              <label
                key={o.key}
                className="cursor-pointer"
                data-testid={`reversal-${o.key}`}
              >
                <input
                  type="radio"
                  value={o.key}
                  className="peer sr-only"
                  {...register("reversal")}
                />
                <span
                  className={cn(
                    "flex h-8 items-center rounded-sm px-3 text-[12.5px] font-medium text-muted-foreground transition-colors",
                    "peer-checked:bg-primary peer-checked:font-semibold peer-checked:text-primary-foreground peer-checked:shadow-sm",
                    "peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                  )}
                >
                  {o.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* actions */}
        <div className="flex items-end gap-2">
          <Button type="button" variant="outline" size="md" className="gap-1.5" disabled>
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
          </Button>
          <Button type="submit" size="md" disabled={offline} data-testid="entries-apply">
            Apply
          </Button>
          <Button type="button" variant="ghost" size="md" onClick={clearAll} data-testid="entries-clear">
            Clear filters
          </Button>
        </div>

        {errors.dateFrom && (
          <p
            id="filter-date-error"
            className="w-full text-[11.5px] text-destructive-ink"
            data-testid="entries-date-error"
          >
            {errors.dateFrom.message}
          </p>
        )}
      </form>
    </Card>
  );
}
