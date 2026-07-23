/**
 * FE-53 — presentation for a notification's `sourceModule` code (from the NTF
 * catalogue: REQ / PUR / INV / SAL / REC / PAY / CC / PER / HR / AUD, plus a
 * LG fallback for ledger-originated rows). Drives the row's 2-letter tint chip
 * and the human source label shown under the body. Glyph + tint + label mirror
 * the shared sidebar IA (`ZAKIR_NAV` / `ZAKIR_TINTS`) so a row reads like the
 * module it came from. Design source of truth: docs/design/design-files/
 * 18-notifications/Notifications.dc.html (frame 02).
 */

export interface ModulePresentation {
  /** 2-letter chip glyph. */
  glyph: string;
  /** Human source label rendered under the body (e.g. "Cost control"). */
  label: string;
  /** Tailwind tint classes for the chip (soft bg + ink fg), tokens only. */
  chip: string;
}

const NEUTRAL: ModulePresentation = {
  glyph: "··",
  label: "System",
  chip: "bg-muted text-muted-foreground",
};

const MAP: Record<string, ModulePresentation> = {
  CC: { glyph: "CC", label: "Cost control", chip: "bg-destructive-soft text-destructive-ink" },
  SAL: { glyph: "IP", label: "Sales / IPC", chip: "bg-accent-soft text-accent-ink" },
  REQ: { glyph: "RQ", label: "Requisitions", chip: "bg-info-soft text-info-ink" },
  PUR: { glyph: "PU", label: "Purchases", chip: "bg-info-soft text-info-ink" },
  INV: { glyph: "IN", label: "Inventory", chip: "bg-warning-soft text-warning-ink" },
  REC: { glyph: "RC", label: "Receipts", chip: "bg-success-soft text-success-ink" },
  PAY: { glyph: "PY", label: "Payments", chip: "bg-teal-soft text-teal-ink" },
  HR: { glyph: "HR", label: "HR & Payroll", chip: "bg-teal-soft text-teal-ink" },
  PER: { glyph: "PE", label: "Periods", chip: "bg-success-soft text-success-ink" },
  AUD: { glyph: "AA", label: "Audit & access", chip: "bg-teal-soft text-teal-ink" },
  LG: { glyph: "LG", label: "Ledger", chip: "bg-violet-soft text-violet-ink" },
};

/** Presentation for a source-module code; a neutral fallback for unknown codes. */
export function modulePresentation(sourceModule: string): ModulePresentation {
  return MAP[sourceModule] ?? { ...NEUTRAL, glyph: sourceModule.slice(0, 2).toUpperCase() };
}
