/**
 * Bangladesh localization helpers (overview §9, skill §8):
 *  - dates render `DD/MM/YYYY` (timestamps are stored ISO-8601 UTC),
 *  - phones are E.164 (`+880XXXXXXXXXX`),
 *  - Bangla text is UTF-8 and must never be truncated/clipped.
 *
 * Money/quantity formatting lives in `./money.ts` (decimal.js, exact).
 */

/** Accepts a Date or an ISO-8601 string / date-only string. */
export type DateInput = Date | string;

function toDate(value: DateInput): Date {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Not a valid date: "${String(value)}"`);
  }
  return d;
}

/** Render a date as `DD/MM/YYYY` (UTC, to match stored ISO-8601 UTC timestamps). */
export function formatDate(value: DateInput): string {
  const d = toDate(value);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/** Render a timestamp as `DD/MM/YYYY HH:mm` (24-hour, UTC). */
export function formatDateTime(value: DateInput): string {
  const d = toDate(value);
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${formatDate(d)} ${hours}:${minutes}`;
}

/** Parse a `DD/MM/YYYY` string into a UTC Date (midnight). Throws on bad input. */
export function parseDate(input: string): Date {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!m) throw new Error(`Expected DD/MM/YYYY, got "${input}"`);
  const [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCDate() !== day || d.getUTCMonth() !== month - 1 || d.getUTCFullYear() !== year) {
    throw new Error(`Invalid calendar date: "${input}"`);
  }
  return d;
}

const E164_BD = /^\+880\d{10}$/;
const E164_ANY = /^\+[1-9]\d{1,14}$/;

/** True when `value` is a valid E.164 phone (any country). */
export function isE164(value: string): boolean {
  return E164_ANY.test(value);
}

/** True when `value` is a valid Bangladeshi E.164 number (`+880` + 10 digits). */
export function isBangladeshPhone(value: string): boolean {
  return E164_BD.test(value);
}

/**
 * Display a phone number. Already-E.164 input is returned verbatim (E.164 is the
 * canonical display + storage form per overview §9). Throws on non-E.164 input
 * so malformed numbers surface instead of silently rendering.
 */
export function formatPhone(value: string): string {
  const trimmed = value.trim();
  if (!isE164(trimmed)) throw new Error(`Not an E.164 phone number: "${value}"`);
  return trimmed;
}

/**
 * Normalise a Bangladeshi local number (`01XXXXXXXXX`, with optional spaces/dashes)
 * to E.164 (`+8801XXXXXXXXX`). Already-E.164 BD input passes through.
 */
export function toBangladeshE164(input: string): string {
  const cleaned = input.replace(/[\s-]/g, "");
  if (E164_BD.test(cleaned)) return cleaned;
  const local = /^0(\d{10})$/.exec(cleaned);
  if (local) return `+880${local[1]}`;
  throw new Error(`Cannot normalise to Bangladesh E.164: "${input}"`);
}

/**
 * Humanize a `SCREAMING_SNAKE_CASE` code into a title-cased label
 * (`ACCOUNTS_MANAGER` → "Accounts Manager"). The project-wide fallback for any
 * role/enum name that has no curated display label — so the UI never shows a raw
 * underscore-joined code. Curated maps (e.g. `USER_ROLE_LABEL`) still win where a
 * label can't be derived by casing alone (e.g. `HR_MANAGER` → "HR Manager").
 */
export function humanizeSnakeCase(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
