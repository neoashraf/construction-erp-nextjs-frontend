import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";

/**
 * Holiday-calendar bindings (`/holidays/*`). Two independent things live here:
 *
 *  - **Weekly off-days** — which JS weekdays are non-working, company-wide.
 *  - **Government/custom holidays** — dated single-day closures for a given year.
 *
 * Both feed the attendance-log working-day maths server-side, so any mutation here
 * invalidates the logs cache (the counts change retroactively).
 *
 * Weekday numbers are the JS convention throughout the wire format: 0 = Sunday … 6 =
 * Saturday. The UI renders Monday-first for a Bangladeshi working week, but never
 * renumbers — display order and value are kept separate (see `WEEKDAY_ORDER`).
 */

function csrf() {
  return { csrfToken: readCsrfToken() };
}

export interface WeeklyOffDays {
  /** JS weekday numbers: 0 = Sunday … 6 = Saturday. */
  weekdays: number[];
}

/**
 * Keep only valid JS weekday numbers.
 *
 * Responses are validated rather than trusted throughout this module: a non-array reaching
 * the UI becomes a `.map is not a function` crash instead of a handled state, and the dev
 * mock answers unimplemented routes with `{ data: { ok, path } }` — so that is the normal
 * case until the backend ships, not an edge case.
 */
function toWeekdays(raw: unknown): number[] {
  const list = (raw as { weekdays?: unknown } | null)?.weekdays;
  if (!Array.isArray(list)) return [];
  return list.filter((d): d is number => typeof d === "number" && d >= 0 && d <= 6);
}

export async function getWeeklyOffDays(): Promise<WeeklyOffDays> {
  const raw = await apiClient.get<unknown>("/holidays/weekly");
  return { weekdays: toWeekdays(raw) };
}

export async function saveWeeklyOffDays(weekdays: number[]): Promise<WeeklyOffDays> {
  const raw = await apiClient.put<unknown>("/holidays/weekly", { weekdays }, csrf());
  // Echo back what we sent if the server's response isn't usable, so the panel's
  // saved-state baseline still matches what the user just committed.
  const confirmed = toWeekdays(raw);
  return { weekdays: confirmed.length > 0 ? confirmed : weekdays };
}

export interface GovernmentHoliday {
  id: string;
  /** `YYYY-MM-DD`. */
  date: string;
  name: string;
  localName?: string | null;
  /** Free-form provenance string; the UI derives a display type from it. */
  source: string;
}

/** Keep only entries with the id + date the table and cache-merge key on. */
function toHolidayList(raw: unknown): GovernmentHoliday[] {
  const list = (raw as { holidays?: unknown } | null)?.holidays;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (h): h is GovernmentHoliday =>
      typeof h === "object" &&
      h !== null &&
      typeof (h as GovernmentHoliday).id === "string" &&
      typeof (h as GovernmentHoliday).date === "string",
  );
}

export async function listGovernmentHolidays(year: number): Promise<GovernmentHoliday[]> {
  const raw = await apiClient.get<unknown>(
    `/holidays/government?year=${encodeURIComponent(String(year))}`,
  );
  return toHolidayList(raw);
}

export interface CreateHolidayInput {
  /** `YYYY-MM-DD`. */
  date: string;
  name: string;
  localName?: string | null;
}

/**
 * Create (or, server-side, upsert) a holiday. Posting a date that already exists updates
 * the existing entry rather than duplicating it — the caller detects that case beforehand
 * to choose the right toast wording and to replace the row in local state.
 */
export async function createGovernmentHoliday(input: CreateHolidayInput): Promise<GovernmentHoliday> {
  const res = await apiClient.post<{ holiday?: Partial<GovernmentHoliday> }>(
    "/holidays/government",
    input,
    csrf(),
  );
  const saved = res?.holiday;
  // The saved row goes straight into the cache keyed by date, so it must always be a
  // well-formed holiday even when the server echoes something thin.
  return {
    id: saved?.id ?? `holiday-${input.date}`,
    date: saved?.date ?? input.date,
    name: saved?.name ?? input.name,
    localName: saved?.localName ?? input.localName ?? null,
    source: saved?.source ?? "manual",
  };
}

export async function deleteGovernmentHoliday(id: string): Promise<void> {
  await apiClient.delete<void>(`/holidays/government/${encodeURIComponent(id)}`, csrf());
}

/** Pull the official calendar for a year from the upstream government API. */
export async function importGovernmentHolidays(year: number): Promise<GovernmentHoliday[]> {
  const raw = await apiClient.post<unknown>("/holidays/government/import", { year }, csrf());
  return toHolidayList(raw);
}

export interface ImportHolidayRow {
  date: string;
  name: string;
  localName?: string | null;
}

export interface ImportExcelResult {
  holidays: GovernmentHoliday[];
  importedCount: number;
}

/** Bulk-insert rows parsed from a spreadsheet (parsing happens client-side). */
export async function importHolidaysFromRows(rows: ImportHolidayRow[]): Promise<ImportExcelResult> {
  const raw = await apiClient.post<unknown>(
    "/holidays/government/import-excel",
    { holidays: rows },
    csrf(),
  );
  const holidays = toHolidayList(raw);
  const count = (raw as { importedCount?: unknown } | null)?.importedCount;
  return {
    holidays,
    importedCount: typeof count === "number" ? count : holidays.length,
  };
}
