"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { DashboardTile } from "./DashboardTile";
import { type Tile, type TopPartyRow, type TopReceivablePayableKpi } from "../types";

/**
 * FE-61 Top Receivables / Payables — a full-width tile with two colour-headed
 * columns (receivables in success-ink, payables in destructive-ink), each a list
 * of party links with the outstanding amount right-aligned. Matches the design's
 * `parties` tile (which spans the full grid row). Bangla names never clip.
 */
export function TopReceivablesPayablesTile(props: {
  tile: Tile;
  onRefresh?: () => void;
  refreshing?: boolean;
  error?: unknown | null;
  stale?: boolean;
}) {
  const kpi = props.tile.kpi as TopReceivablePayableKpi;
  return (
    <DashboardTile
      tile={props.tile}
      onRefresh={props.onRefresh}
      refreshing={props.refreshing}
      error={props.error}
      stale={props.stale}
      className="sm:col-span-2 xl:col-span-3"
    >
      <div className="grid gap-x-[22px] gap-y-0 sm:grid-cols-2">
        <PartyList
          title="Receivables"
          tone="text-success-ink"
          rows={kpi.topReceivables}
          testid="tile-top-recv"
        />
        <PartyList
          title="Payables"
          tone="text-destructive-ink"
          rows={kpi.topPayables}
          testid="tile-top-pay"
        />
      </div>
    </DashboardTile>
  );
}

function PartyList({
  title,
  tone,
  rows,
  testid,
}: {
  title: string;
  tone: string;
  rows: TopPartyRow[];
  testid: string;
}) {
  return (
    <div className="min-w-0" data-testid={testid}>
      <div className={cn("mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.4px]", tone)}>
        {title}
      </div>
      {rows.length === 0 ? (
        <p className="py-1.5 text-[12.5px] italic text-muted-foreground">No {title.toLowerCase()}</p>
      ) : (
        rows.map((r) => (
          <Link
            key={r.partyId}
            href={`/reports/trial-balance-ledgers?partyId=${r.partyId}`}
            className="flex items-baseline justify-between gap-2.5 border-b border-muted py-1.5 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Open ledger for ${r.partyName}`}
          >
            <span className="min-w-0 flex-1 break-words text-[12.5px] font-medium text-foreground">
              {r.partyName}
            </span>
            <span className="flex-none font-mono text-[12.5px] font-semibold tabular-nums text-foreground">
              {formatMoney(r.outstanding, { grouping: "lakh", fractionDigits: 2 })}
            </span>
          </Link>
        ))
      )}
    </div>
  );
}
