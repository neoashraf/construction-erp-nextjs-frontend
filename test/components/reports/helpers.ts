/**
 * Shared test helpers for the reports viewer suites.
 *
 * The "match design files" refactor (commit 81b3281) changed two things in the
 * shared ReportParameterPanel that every viewer suite has to drive:
 *
 *  1. Date params (as-of / date-from / date-to) are no longer raw `<input>`s.
 *     The `data-testid` now sits on a WRAPPER `<div>` around a styled
 *     `DatePickerInput`; the real `<input>` inside carries only an `id` and
 *     speaks the app-standard `DD/MM/YYYY` display format (params still store
 *     ISO — `ReportDateField` bridges the two, committing ISO only once the
 *     text is a complete valid `DD/MM/YYYY`). Firing `change` on the testid
 *     `<div>` throws "element does not have a value setter", so tests must
 *     reach the inner `<input>` and send a DD/MM/YYYY string.
 *
 *  2. Secondary params (project, cost centre, report-specific extras) are now
 *     collapsed behind a `Filters` disclosure (`report-filters-toggle`) — they
 *     aren't in the DOM until the toggle is opened.
 */
import { fireEvent, screen, within } from "@testing-library/react";

/** ISO `YYYY-MM-DD` → the field's `DD/MM/YYYY` display string. */
export function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** The inner `<input>` behind a date field's testid `<div>`. */
export function dateInput(testId: string): HTMLInputElement {
  return within(screen.getByTestId(testId)).getByRole("textbox") as HTMLInputElement;
}

/**
 * Set a report date param. Accepts an ISO `YYYY-MM-DD` (what the old tests passed)
 * OR an already-formatted `DD/MM/YYYY`; converts ISO to the display format the
 * field commits from, then fires a change on the inner input so the panel commits
 * the ISO value to params.
 */
export function setDateField(testId: string, value: string): void {
  const display = /^\d{4}-\d{2}-\d{2}$/.test(value) ? isoToDisplay(value) : value;
  fireEvent.change(dateInput(testId), { target: { value: display } });
}

/** Open the `Filters` disclosure so project / cost-centre / extra fields mount. */
export function openFilters(): void {
  fireEvent.click(screen.getByTestId("report-filters-toggle"));
}
