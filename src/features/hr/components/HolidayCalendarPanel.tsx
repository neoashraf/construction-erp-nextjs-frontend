"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarDays, Download, FileSpreadsheet, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { HolidayFormDrawer } from "./HolidayFormDrawer";
import { StatCard } from "./AttendanceStats";
import { type GovernmentHoliday } from "../api/holidays";
import {
  useDeleteHoliday,
  useGovernmentHolidays,
  useImportGovernmentHolidays,
  useImportHolidayRows,
  useWeeklyOffDays,
} from "../hooks/useHolidays";
import { HolidayImportError, downloadHolidayTemplate, parseHolidayWorkbook } from "../lib/attendance-export";
import { selectableYears } from "../lib/attendance-filters";
import { formatDayLabel } from "../lib/attendance-time";
import {
  HOLIDAY_TYPES,
  HOLIDAY_TYPE_DESCRIPTION,
  HOLIDAY_TYPE_TONE,
  holidayTypeOf,
  isUpcoming,
  summarizeHolidays,
  upcomingHolidays,
  weekdayName,
  type HolidayType,
} from "../lib/holiday-types";

/**
 * The dated holiday calendar for one year: summary counts, upcoming list, and a filterable
 * table with create/delete and two import paths.
 *
 * Type/search filtering is client-side over the loaded year — the whole year is a small,
 * already-fetched list, so filtering locally keeps the pills instant and avoids a refetch
 * per keystroke.
 */
export function HolidayCalendarPanel() {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [typeFilter, setTypeFilter] = useState<HolidayType | "All">("All");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<GovernmentHoliday | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const holidaysQuery = useGovernmentHolidays(year);
  const weeklyQuery = useWeeklyOffDays();
  const importApi = useImportGovernmentHolidays(year);
  const importRows = useImportHolidayRows(year);
  const remove = useDeleteHoliday(year);

  const holidays = useMemo(() => holidaysQuery.data ?? [], [holidaysQuery.data]);
  const weeklyOffCount = weeklyQuery.data?.weekdays.length ?? 0;
  const summary = useMemo(
    () => summarizeHolidays(holidays, weeklyOffCount),
    [holidays, weeklyOffCount],
  );
  const upcoming = useMemo(() => upcomingHolidays(holidays), [holidays]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return holidays.filter((holiday) => {
      if (typeFilter !== "All" && holidayTypeOf(holiday) !== typeFilter) return false;
      if (!term) return true;
      // Matching the raw date string lets users search "2026-03" for a whole month.
      return (
        holiday.name.toLowerCase().includes(term) ||
        holiday.date.toLowerCase().includes(term) ||
        (holiday.localName ?? "").toLowerCase().includes(term)
      );
    });
  }, [holidays, typeFilter, search]);

  // Calendars are published years ahead and consulted years back, so the picker spans a
  // wide range rather than the current year and its immediate neighbours.
  const years = selectableYears(year);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately so re-picking the same file still fires `change`.
    event.target.value = "";
    if (!file) return;

    try {
      const rows = await parseHolidayWorkbook(file);
      importRows.mutate(rows, {
        onSuccess: (result) => toast(`Imported ${result.importedCount} holiday(s)`, "success"),
        onError: (error) =>
          toast(error instanceof ApiError ? error.message : "Import failed", "error"),
      });
    } catch (error) {
      toast(error instanceof HolidayImportError ? error.message : "Could not read that file", "error");
    }
  }

  function handleDelete(holiday: GovernmentHoliday) {
    remove.mutate(holiday.id, {
      onSuccess: () => toast("Holiday deleted", "success"),
      onError: (error) =>
        toast(error instanceof ApiError ? error.message : "Could not delete holiday", "error"),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary + upcoming */}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total holidays" value={summary.total} />
        <StatCard label="National" value={summary.byType.National} />
        <StatCard label="Religious" value={summary.byType.Religious} />
        <StatCard label="Special" value={summary.byType.Special} tone="muted" />
        <StatCard label="Working days (approx.)" value={summary.workingDays} />
      </div>

      {upcoming.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface px-3 py-2.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">
            Upcoming
          </span>
          {upcoming.map((holiday) => (
            <span
              key={holiday.id}
              className="inline-flex items-center gap-2 rounded-pill bg-muted px-2.5 py-1 text-[12px]"
            >
              <span className="font-semibold text-foreground">{holiday.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatDayLabel(holiday.date)}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3">
        <Select
          aria-label="Year"
          className="h-9 w-[104px]"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>

        <div className="inline-flex rounded-token border border-border-strong p-0.5" role="group" aria-label="Holiday type">
          {(["All", ...HOLIDAY_TYPES] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={typeFilter === type}
              onClick={() => setTypeFilter(type)}
              className={cn(
                "h-7 rounded-sm px-3 text-[12.5px] font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                typeFilter === type
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <Input
            className="pl-9"
            placeholder="Search name or date"
            aria-label="Search holidays"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => importApi.mutate(undefined, {
            onSuccess: (list) => toast(`Imported ${list.length} holiday(s)`, "success"),
            onError: (error) =>
              toast(error instanceof ApiError ? error.message : "Import failed", "error"),
          })}
          disabled={importApi.isPending}
        >
          <RefreshCw className={importApi.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
          {importApi.isPending ? "Importing…" : "Import from API"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={importRows.isPending}
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          {importRows.isPending ? "Importing…" : "Import Excel"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => void handleFile(e)}
        />

        <Button variant="ghost" size="sm" onClick={() => void downloadHolidayTemplate()}>
          <Download className="h-4 w-4" aria-hidden />
          Template
        </Button>

        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDrawerOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add holiday
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-card border border-border bg-surface">
        {holidaysQuery.isLoading ? (
          <div className="flex flex-col gap-2 p-4" role="status" aria-live="polite">
            <span className="sr-only">Loading holidays</span>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : holidaysQuery.isError ? (
          <div role="alert" className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-destructive-ink">
              {holidaysQuery.error instanceof ApiError
                ? holidaysQuery.error.message
                : "Could not load holidays"}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={CalendarDays}
              title={holidays.length === 0 ? "No holidays for this year" : "No matching holidays"}
              description={
                holidays.length === 0
                  ? "Import the government calendar, upload a spreadsheet, or add holidays manually."
                  : "Try a different type or search term."
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead className="w-[112px]">Day</TableHead>
                <TableHead>Holiday name</TableHead>
                <TableHead className="w-[104px]">Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[96px]">Status</TableHead>
                <TableHead className="w-[64px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((holiday) => {
                const type = holidayTypeOf(holiday);
                const upcomingRow = isUpcoming(holiday.date);
                return (
                  <TableRow key={holiday.id}>
                    <TableCell className="text-[12.5px] font-semibold tabular-nums">
                      {formatDayLabel(holiday.date)}
                    </TableCell>
                    <TableCell className="text-[12.5px] text-muted-foreground">
                      {weekdayName(holiday.date)}
                    </TableCell>
                    <TableCell>
                      <div className="text-[13px] font-semibold text-foreground">{holiday.name}</div>
                      {holiday.localName ? (
                        <div className="text-[11.5px] text-muted-foreground">{holiday.localName}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge tone={HOLIDAY_TYPE_TONE[type]}>{type}</Badge>
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {HOLIDAY_TYPE_DESCRIPTION[type]}
                    </TableCell>
                    <TableCell>
                      <Badge tone={upcomingRow ? "success" : "neutral"} dot>
                        {upcomingRow ? "Upcoming" : "Passed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        aria-label={`Delete ${holiday.name}`}
                        disabled={remove.isPending}
                        onClick={() => handleDelete(holiday)}
                        className="grid h-8 w-8 place-items-center rounded-token text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <HolidayFormDrawer
        open={drawerOpen}
        year={year}
        existing={editing}
        holidays={holidays}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}
