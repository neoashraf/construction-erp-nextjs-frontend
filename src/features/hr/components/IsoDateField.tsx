"use client";

import { DatePickerInput } from "@/components/ui/date-picker";
import { parseDateOnly, toIsoDate } from "../lib/attendance-time";

/**
 * Adapter between the shared `DatePickerInput` (which speaks the app-wide `DD/MM/YYYY`
 * display format) and this feature's `YYYY-MM-DD` wire format.
 *
 * The shared picker is UTC-based because it serves ISO-8601 stored timestamps; attendance
 * dates are plain calendar days. Converting through local components here keeps a picked
 * day from sliding by one in a negative-offset timezone.
 */
export function IsoDateField({
  id,
  value,
  onChange,
  disabled,
  className,
}: {
  id?: string;
  /** `YYYY-MM-DD`, or "" when unset. */
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const display = (() => {
    const date = parseDateOnly(value);
    if (!date) return "";
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${d}/${m}/${date.getFullYear()}`;
  })();

  function handleChange(next: string) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(next.trim());
    if (!match) {
      // Partial/cleared input — report empty rather than a half-typed date.
      onChange("");
      return;
    }
    const [, dd, mm, yyyy] = match;
    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (Number.isNaN(date.getTime())) {
      onChange("");
      return;
    }
    onChange(toIsoDate(date));
  }

  return (
    <DatePickerInput
      id={id}
      value={display}
      onChange={handleChange}
      disabled={disabled}
      className={className}
    />
  );
}
