import { type AuditDiffField, type AuditDiffViewModel, type AuditLogDetail } from "../types";

/**
 * Build the before/after diff view-model (FR-AUD-022; spec §6/§13). CREATE ->
 * `after`-only fields ("Created — no previous value."); DELETE -> `before`-only
 * fields ("Deleted — no new value."); everything else (UPDATE/POST/CANCEL/
 * APPROVE/REJECT/ACTIVATE/DEACTIVATE) shows both sides, field by field, flagging
 * `changed` by a simple deep-equality-by-JSON compare. `before`/`after` are
 * already API-sanitised (no password_hash/encrypted fields) — this never special-
 * cases field names to hide, it only renders what the API returned.
 */
export function buildAuditDiff(
  entry: Pick<AuditLogDetail, "before" | "after">,
): AuditDiffViewModel {
  const { before, after } = entry;

  if (before === null && after !== null) {
    return { mode: "create", fields: objectToFields(after, "after") };
  }
  if (after === null && before !== null) {
    return { mode: "delete", fields: objectToFields(before, "before") };
  }

  const beforeObj = before ?? {};
  const afterObj = after ?? {};
  const keys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])).sort();

  const fields: AuditDiffField[] = keys.map((key) => {
    const b = beforeObj[key];
    const a = afterObj[key];
    return { field: key, before: b, after: a, changed: !valuesEqual(b, a) };
  });

  return { mode: "both", fields };
}

function objectToFields(obj: Record<string, unknown>, side: "before" | "after"): AuditDiffField[] {
  return Object.keys(obj)
    .sort()
    .map((key) => ({
      field: key,
      before: side === "before" ? obj[key] : undefined,
      after: side === "after" ? obj[key] : undefined,
      changed: false,
    }));
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return a === b;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** Render a diff field's raw value for display — never throws on odd shapes. */
export function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
