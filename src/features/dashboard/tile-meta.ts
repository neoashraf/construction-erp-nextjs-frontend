import { type TileKey } from "./types";

/**
 * FE-61 per-tile presentation metadata — mirrors the design file
 * (docs/design/design-files/16-dashboard/Dashboard.dc.html): each KPI carries
 * the owning module's tint (icon-chip soft-bg + ink) and its two-letter glyph.
 * Tints map 1:1 to design-system tokens (styles/tokens.css) — never raw hex.
 */
export interface TileMeta {
  /** Two-letter glyph shown in the icon chip (design: CF, IP, RT, LS, OB, AT, RP). */
  glyph: string;
  /** Tailwind classes for the icon chip: soft background + ink foreground. */
  chip: string;
}

export const TILE_META: Record<TileKey, TileMeta> = {
  "project-cash-flow": { glyph: "CF", chip: "bg-success-soft text-success-ink" },
  "pending-ipcs": { glyph: "IP", chip: "bg-accent-soft text-accent-ink" },
  "retention-held": { glyph: "RT", chip: "bg-violet-soft text-violet-ink" },
  "low-stock": { glyph: "LS", chip: "bg-warning-soft text-warning-ink" },
  "over-budget": { glyph: "OB", chip: "bg-destructive-soft text-destructive-ink" },
  "attendance-summary": { glyph: "AT", chip: "bg-teal-soft text-teal-ink" },
  "top-receivables-payables": { glyph: "RP", chip: "bg-info-soft text-info-ink" },
};

export function tileMeta(key: TileKey): TileMeta {
  return TILE_META[key] ?? { glyph: "··", chip: "bg-muted text-muted-foreground" };
}
