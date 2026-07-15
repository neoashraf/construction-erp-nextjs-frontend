"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { DashboardTile } from "./DashboardTile";
import { type Tile, type TopPartyRow, type TopReceivablePayableKpi } from "../types";

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
      icon={<Coins className="h-4 w-4" aria-hidden />}
      onRefresh={props.onRefresh}
      refreshing={props.refreshing}
      error={props.error}
      stale={props.stale}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <PartyList title="Receivables" rows={kpi.topReceivables} testid="tile-top-recv" />
        <PartyList title="Payables" rows={kpi.topPayables} testid="tile-top-pay" />
      </div>
    </DashboardTile>
  );
}

function PartyList({
  title,
  rows,
  testid,
}: {
  title: string;
  rows: TopPartyRow[];
  testid: string;
}) {
  return (
    <div data-testid={testid}>
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {rows.length === 0 ? (
        <p className="mt-1 text-[12px] italic text-muted-foreground">No {title.toLowerCase()}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {rows.map((r) => (
            <li key={r.partyId} className="flex items-baseline justify-between gap-2">
              <Link
                href={`/reports/trial-balance-ledgers?partyId=${r.partyId}`}
                className="truncate text-[12.5px] font-medium text-accent-ink hover:underline"
                aria-label={`Open ledger for ${r.partyName}`}
              >
                {r.partyName}
              </Link>
              <span className="whitespace-nowrap text-[12.5px] font-semibold tabular-nums text-foreground">
                {formatMoney(r.outstanding)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
