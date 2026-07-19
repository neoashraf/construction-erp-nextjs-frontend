import Decimal from "decimal.js";
import { formatMoney, type DecimalInput } from "@/lib/money";
import {
  type AttendanceKpi,
  type CashFlowKpi,
  type LowStockKpi,
  type OverBudgetKpi,
  type PendingIpcKpi,
  type RetentionHeldKpi,
  type Tile,
  type TopReceivablePayableKpi,
} from "./types";

/**
 * FE-61 compact tile view-model — mirrors the design file's `compactVM` (the
 * tablet/mobile summary rendering): each KPI collapses to a single headline plus
 * one summary line. Money is lakh-grouped, 2-decimal, matching the design.
 */
export interface CompactVM {
  headline: string;
  subline: string;
  /** Tailwind text-colour class for the headline (default foreground). */
  headClass: string;
  /** True when the subline (or headline) contains Bangla — kept for a11y hints. */
  hasBangla: boolean;
}

const money = (v: DecimalInput) => formatMoney(v, { grouping: "lakh", fractionDigits: 2 });

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  const idx = Math.max(0, Math.min(11, Number(m) - 1));
  return `${MONTHS[idx]} ${y}`;
}

const hasBangla = (s: string) => /[ঀ-৿]/.test(s);

export function compactVM(tile: Tile): CompactVM {
  switch (tile.key) {
    case "project-cash-flow": {
      const k = tile.kpi as CashFlowKpi;
      const net = new Decimal(k.netInflow);
      const negative = net.isNegative();
      return {
        headline: (negative ? "− " : "+ ") + money(net.abs()),
        subline: `Net cash flow · cash ${money(k.cashBalance)} · bank ${money(k.bankBalance)}`,
        headClass: negative ? "text-destructive-ink" : "text-success-ink",
        hasBangla: false,
      };
    }
    case "pending-ipcs": {
      const k = tile.kpi as PendingIpcKpi;
      return {
        headline: String(k.count),
        subline: `IPCs pending · Total outstanding ${money(k.totalOutstanding)}`,
        headClass: "text-foreground",
        hasBangla: false,
      };
    }
    case "retention-held": {
      const k = tile.kpi as RetentionHeldKpi;
      return {
        headline: money(k.totalRetentionHeld),
        subline: "Total retention held",
        headClass: "text-foreground",
        hasBangla: false,
      };
    }
    case "low-stock": {
      const k = tile.kpi as LowStockKpi;
      return {
        headline: String(k.count),
        subline: "items at or below re-order level",
        headClass: "text-destructive-ink",
        hasBangla: false,
      };
    }
    case "over-budget": {
      const k = tile.kpi as OverBudgetKpi;
      return {
        headline: `${k.overCount} / ${k.approachingCount}`,
        subline: "over budget / approaching · lifetime to date",
        headClass: "text-destructive-ink",
        hasBangla: false,
      };
    }
    case "attendance-summary": {
      const k = tile.kpi as AttendanceKpi;
      const head = Number(k.headCountTotal);
      const headStr = Number.isFinite(head) ? head.toFixed(1) : k.headCountTotal;
      return {
        headline: String(k.presentDays),
        subline: `${monthLabel(k.period)} · ${headStr} total head count`,
        headClass: "text-foreground",
        hasBangla: false,
      };
    }
    case "top-receivables-payables": {
      const k = tile.kpi as TopReceivablePayableKpi;
      const r = k.topReceivables[0];
      const p = k.topPayables[0];
      const sub = r
        ? `Top receivable: ${r.partyName}${p ? ` · top payable ${p.partyName} ${money(p.outstanding)}` : ""}`
        : "No receivables";
      return {
        headline: r ? money(r.outstanding) : "—",
        subline: sub,
        headClass: "text-foreground",
        hasBangla: hasBangla(sub),
      };
    }
    default:
      return { headline: "—", subline: "", headClass: "text-foreground", hasBangla: false };
  }
}
