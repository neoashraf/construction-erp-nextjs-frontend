"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
import { formatDayLabel, parseDateOnly } from "../lib/attendance-time";
import {
  HOLIDAY_TYPES,
  HOLIDAY_TYPE_DESCRIPTION,
  HOLIDAY_TYPE_TONE,
  MANUAL_SOURCE_TOOLTIP,
  holidaySourceLabel,
  holidayTypeOf,
  isUpcoming,
  summarizeHolidays,
  upcomingHolidays,
  weekdayName,
  type HolidayType,
} from "../lib/holiday-types";

/**
 * The dated holiday calendar for one year (FR-HR-008d): summary counts, upcoming strip,
 * and a filterable table with add/edit/delete plus two import paths.
 *
 * Type/search filtering is client-side over the loaded year — a year is a small,
 * fully-fetched list, so the pills stay instant and typing never queues requests.
 *
 * Payroll-critical rules carried here (see the screen spec §5/§9):
 *  - The Source column ("From feed" / "Entered by hand") is the only thing on a row that
 *    says what the next year-end sync will do to it — a manual row is never overwritten.
 *  - The feed-import toast reports BOTH counts (written and left unchanged); silence about
 *    hand-entered rows reads as loss.
 *  - Delete is confirmed first — its effect (a date retroactively becoming a working day
 *    again) is exactly the effect that produces a wrong salary.
 *  - The two imports never run concurrently: both write the same company-year, and the
 *    loser of a race vanishes with nothing on screen to show it.
 */
export function HolidayCalendarPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [typeFilter, setTypeFilter] = useState<HolidayType | "All">("All");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<GovernmentHoliday | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleting, setDeleting] = useState<GovernmentHoliday | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const holidaysQuery = useGovernmentHolidays(year);
  const weeklyQuery = useWeeklyOffDays();
  const importApi = useImportGovernmentHolidays(year);
  const importRows = useImportHolidayRows(year);
  const remove = useDeleteHoliday(year);

  const holidays = useMemo(() => holidaysQuery.data ?? [], [holidaysQuery.data]);
  // `null` (not 0) while the weekly query is unresolved or failed — the approx card must
  // show "—" rather than silently rendering ~104 extra working days as fact.
  const weeklyOffCount = weeklyQuery.data ? weeklyQuery.data.weekdays.length : null;
  const weeklyOffSet = useMemo(
    () => new Set(weeklyQuery.data?.weekdays ?? []),
    [weeklyQuery.data],
  );
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
      // Both date forms match: the raw wire string lets "2026-03" pull a whole month, and
      // the rendered DD/MM/YYYY is the only form the user has actually been shown.
      return (
        holiday.name.toLowerCase().includes(term) ||
        holiday.date.toLowerCase().includes(term) ||
        formatDayLabel(holiday.date).toLowerCase().includes(term) ||
        (holiday.localName ?? "").toLowerCase().includes(term)
      );
    });
  }, [holidays, typeFilter, search]);

  // Calendars are published years ahead and consulted years back, so the picker spans a
  // wide range rather than the current year and its immediate neighbours.
  const years = selectableYears(year);

  // Both imports write the same company-year through upserts — while either is in flight
  // the other is disabled, so a race cannot silently swallow the loser.
  const importing = importApi.isPending || importRows.isPending;

  function runFeedImport() {
    importApi.mutate(undefined, {
      onSuccess: (list) => {
        const untouched = list.filter((h) => holidaySourceLabel(h.source) === "Entered by hand").length;
        toast(
          `${list.length - untouched} holidays imported · ${untouched} hand-entered rows left unchanged.`,
          "success",
        );
      },
      onError: () => toast("Couldn't import the government calendar.", "error"),
    });
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately so re-picking the same file still fires `change`.
    event.target.value = "";
    if (!file) return;

    try {
      // All-or-nothing at both layers: the parser throws on the first bad row (its
      // row-numbered message is shown verbatim — the row number is the whole point) and
      // nothing is posted; the server re-validates the whole array before writing.
      const rows = await parseHolidayWorkbook(file);
      importRows.mutate(rows, {
        onSuccess: (result) => toast(`Imported ${result.importedCount} holiday(s).`, "success"),
        onError: (error) =>
          toast(error instanceof ApiError ? error.message : "Import failed.", "error"),
      });
    } catch (error) {
      toast(error instanceof HolidayImportError ? error.message : "Could not read that file.", "error");
    }
  }

  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    remove.mutate(target.id, {
      onSuccess: (result) => {
        // Deleted by someone else already → the intent was achieved; informational, not an error.
        if (result.alreadyDeleted) toast("That holiday was already deleted.");
        else toast("Holiday deleted.", "success");
      },
      onError: (error) =>
        toast(error instanceof ApiError ? error.message : "Couldn't delete holiday.", "error"),
    });
  }

  /** Accent the weekday when it is one of the configured weekly off-days — the collision
   *  a government holiday legitimately overrides (FR-HR-008d precedence). */
  function weekdayTone(isoDate: string): string {
    const d = parseDateOnly(isoDate);
    return d && weeklyOffSet.has(d.getDay()) ? "text-accent-ink" : "text-muted-foreground";
  }

  const yearEmpty = holidays.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary strip */}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total holidays" value={summary.total} />
        <StatCard label="National" value={summary.byType.National} />
        <StatCard label="Religious" value={summary.byType.Religious} />
        <StatCard label="Special" value={summary.byType.Special} tone="muted" />
        <StatCard
          label="Working days (approx.)"
          value={summary.workingDays == null ? "—" : summary.workingDays}
          caption="Estimate only — payroll uses the exact per-employee figure."
        />
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
      <div className="rounded-card border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
          <Select
            aria-label="Year"
            className="h-9 w-[88px]"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>

          <div
            className="hidden rounded-token border border-border-strong p-0.5 md:inline-flex"
            role="group"
            aria-label="Holiday type"
          >
            {(["All", ...HOLIDAY_TYPES] as const).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={typeFilter === type}
                onClick={() => setTypeFilter(type)}
                className={cn(
                  "h-7 rounded-sm px-2.5 text-[12.5px] font-semibold transition-colors",
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

          <div className="relative min-w-[160px] flex-1 xl:min-w-0">
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

          {!readOnly ? (
            <div className="flex flex-wrap items-center gap-2 md:ml-auto md:justify-end xl:flex-none">
              <Button variant="outline" size="sm" onClick={runFeedImport} disabled={importing}>
                <RefreshCw className={importApi.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
                {importApi.isPending ? "Importing…" : "Import from API"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="hidden md:inline-flex"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
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

              <Button
                variant="ghost"
                size="sm"
                className="hidden md:inline-flex"
                onClick={() => void downloadHolidayTemplate()}
              >
                <Download className="h-4 w-4" aria-hidden />
                <span className="xl:sr-only">Template</span>
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
          ) : null}
        </div>

        {!readOnly ? (
          <div className="mt-2.5 border-t border-border pt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
            <div className="hidden md:block">
              <p>
                Columns: Date · Holiday Name · Local Name (optional). Download the template to
                see the exact headers.
              </p>
              <p>The whole file is checked before anything is saved — one bad row and nothing is imported.</p>
            </div>
            <p className="md:hidden">Spreadsheet import is available on a larger screen.</p>
          </div>
        ) : null}
      </div>

      {/* Table / card list */}
      <div className="rounded-card border border-border bg-surface">
        {holidaysQuery.isLoading ? (
          <div className="flex flex-col gap-2 p-4" role="status" aria-live="polite">
            <span className="sr-only">Loading holidays</span>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : holidaysQuery.isError ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-destructive-ink">Couldn&apos;t load holidays.</p>
            <Button variant="outline" size="sm" onClick={() => void holidaysQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            {yearEmpty ? (
              <EmptyState
                icon={CalendarDays}
                title="No holidays for this year"
                description="Import the government calendar, upload a spreadsheet, or add holidays manually."
                action={
                  !readOnly ? (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button variant="outline" size="sm" onClick={runFeedImport} disabled={importing}>
                        {importApi.isPending ? "Importing…" : "Import from API"}
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
                  ) : undefined
                }
              />
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="No matching holidays"
                description="Try a different type or search term."
              />
            )}
          </div>
        ) : (
          <>
            {/* ≥768: table (Description behind a row expander below 1024) */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead className="w-[112px]">Day</TableHead>
                    <TableHead>Holiday name</TableHead>
                    <TableHead className="w-[104px]">Type</TableHead>
                    <TableHead className="w-[136px]">Source</TableHead>
                    <TableHead className="hidden lg:table-cell">Description</TableHead>
                    <TableHead className="w-[96px]">Status</TableHead>
                    {!readOnly ? <TableHead className="w-[88px] text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((holiday) => {
                    const type = holidayTypeOf(holiday);
                    const sourceLabel = holidaySourceLabel(holiday.source);
                    const upcomingRow = isUpcoming(holiday.date);
                    const expanded = expandedId === holiday.id;
                    return (
                      <React.Fragment key={holiday.id}>
                        <TableRow>
                          <TableCell className="text-[12.5px] font-semibold tabular-nums">
                            {formatDayLabel(holiday.date)}
                          </TableCell>
                          <TableCell className={cn("text-[12.5px]", weekdayTone(holiday.date))}>
                            {weekdayName(holiday.date)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-start gap-1.5">
                              <div className="min-w-0">
                                <div className="text-[13px] font-semibold text-foreground">
                                  {holiday.name}
                                </div>
                                {holiday.localName ? (
                                  // Bangla on its own line, part of the reading order — wraps,
                                  // never clips or truncates (CLAUDE.md Bangla/UTF-8).
                                  <div className="whitespace-normal break-words text-[11.5px] text-muted-foreground">
                                    {holiday.localName}
                                  </div>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                aria-label={`${expanded ? "Hide" : "Show"} description for ${holiday.name}`}
                                aria-expanded={expanded}
                                onClick={() => setExpandedId(expanded ? null : holiday.id)}
                                className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-sm border border-border-strong text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                              >
                                {expanded ? (
                                  <Minus className="h-3 w-3" aria-hidden />
                                ) : (
                                  <Plus className="h-3 w-3" aria-hidden />
                                )}
                              </button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge tone={HOLIDAY_TYPE_TONE[type]}>{type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              tone="neutral"
                              title={sourceLabel === "Entered by hand" ? MANUAL_SOURCE_TOOLTIP : undefined}
                            >
                              {sourceLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden text-[12px] text-muted-foreground lg:table-cell">
                            {HOLIDAY_TYPE_DESCRIPTION[type]}
                          </TableCell>
                          <TableCell>
                            <Badge tone={upcomingRow ? "success" : "neutral"} dot>
                              {upcomingRow ? "Upcoming" : "Passed"}
                            </Badge>
                          </TableCell>
                          {!readOnly ? (
                            <TableCell className="text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  aria-label={`Edit ${holiday.name}`}
                                  onClick={() => {
                                    setEditing(holiday);
                                    setDrawerOpen(true);
                                  }}
                                  className="grid h-8 w-8 place-items-center rounded-token text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <Pencil className="h-4 w-4" aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Delete ${holiday.name}`}
                                  disabled={remove.isPending}
                                  onClick={() => setDeleting(holiday)}
                                  className="grid h-8 w-8 place-items-center rounded-token text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden />
                                </button>
                              </div>
                            </TableCell>
                          ) : null}
                        </TableRow>
                        {expanded ? (
                          <TableRow className="lg:hidden">
                            <TableCell
                              colSpan={readOnly ? 6 : 7}
                              className="bg-muted/40 text-[12px] text-muted-foreground"
                            >
                              {HOLIDAY_TYPE_DESCRIPTION[type]}
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* <768: card list (graceful degrade, not a designed tier) */}
            <ul className="flex flex-col gap-2 p-3 md:hidden">
              {filtered.map((holiday) => {
                const type = holidayTypeOf(holiday);
                const sourceLabel = holidaySourceLabel(holiday.source);
                return (
                  <li
                    key={holiday.id}
                    className="rounded-card border border-border bg-surface p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[13px] font-bold tabular-nums">
                            {formatDayLabel(holiday.date)}
                          </span>
                          <span className={cn("text-[12px] font-semibold", weekdayTone(holiday.date))}>
                            {weekdayName(holiday.date)}
                          </span>
                        </div>
                        <div className="mt-1 text-[13px] font-semibold text-foreground">
                          {holiday.name}
                        </div>
                        {holiday.localName ? (
                          <div className="whitespace-normal break-words text-[11.5px] text-muted-foreground">
                            {holiday.localName}
                          </div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge tone={HOLIDAY_TYPE_TONE[type]}>{type}</Badge>
                          <Badge
                            tone="neutral"
                            title={sourceLabel === "Entered by hand" ? MANUAL_SOURCE_TOOLTIP : undefined}
                          >
                            {sourceLabel}
                          </Badge>
                        </div>
                      </div>
                      {!readOnly ? (
                        <button
                          type="button"
                          aria-label={`Delete ${holiday.name}`}
                          disabled={remove.isPending}
                          onClick={() => setDeleting(holiday)}
                          className="grid h-11 w-11 flex-none place-items-center rounded-token border border-border-strong text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
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

      {deleting ? (
        <Dialog open onOpenChange={(next) => !next && setDeleting(null)}>
          <DialogContent hideClose>
            <DialogTitle>{`Delete ${deleting.name}?`}</DialogTitle>
            <DialogDescription className="mt-2">
              {formatDayLabel(deleting.date)} will count as a working day again — in every
              month, including months already reported.
            </DialogDescription>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={confirmDelete}>
                Delete holiday
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
