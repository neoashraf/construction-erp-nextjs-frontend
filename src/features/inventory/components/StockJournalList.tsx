"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatMoney, formatQty } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";
import { MODE_LABEL } from "../schemas/stock-journal.schema";
import { type GodownOption, type ItemOption, type StockJournal, type UserOption } from "../types";

/** Name-resolution maps the screen passes down (id → display, Bangla-safe). */
export interface NameMaps {
  godowns: Map<string, GodownOption>;
  items: Map<string, ItemOption>;
  users: Map<string, UserOption>;
}

const GRID = "minmax(92px,1.1fr) 76px 82px 96px 84px 84px minmax(104px,1.2fr) 100px 112px 84px 36px";
const MONEY = "whitespace-nowrap font-mono text-[13px] tabular-nums text-foreground";

function godownName(maps: NameMaps, id: string | null): string {
  if (!id) return "—";
  return maps.godowns.get(id)?.code ?? id.slice(0, 6);
}
function itemLabel(maps: NameMaps, id: string): { name: string; uom: string } {
  const i = maps.items.get(id);
  return { name: i?.name ?? id.slice(0, 8), uom: i?.uom ?? "" };
}

/**
 * Stock Journal list (spec §4.A). Full grid at ≥lg (scrolls within its own container if
 * narrow); stacked cards below lg for the site-facing ≥360 case. Entry-no cell is the lime
 * link (or "(draft)"); status = pill + dot; money/qty right-aligned + tabular. Kebab: Open ·
 * Go to ledger entry · Copy entry no.
 */
export function StockJournalList({ rows, maps }: { rows: StockJournal[]; maps: NameMaps }) {
  const router = useRouter();
  return (
    <div data-testid="sj-list">
      {/* ≥lg table (horizontal-scrolls within its own container) */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 950 }}>
          <div
            role="row"
            className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
            style={{ gridTemplateColumns: GRID }}
          >
            <div className="py-3">Entry no</div>
            <div className="py-3">Date</div>
            <div className="py-3">Mode</div>
            <div className="py-3">Status</div>
            <div className="py-3">From</div>
            <div className="py-3">To</div>
            <div className="py-3">Item</div>
            <div className="py-3 text-right">Quantity</div>
            <div className="py-3 text-right">Value ৳</div>
            <div className="py-3">Approver</div>
            <div className="py-3" />
          </div>
          {rows.map((r) => {
            const it = itemLabel(maps, r.itemId);
            return (
              <div
                key={r.id}
                role="row"
                data-testid={`sj-row-${r.status}`}
                className="grid cursor-pointer items-center gap-2 border-b border-muted px-4 hover:bg-surface-2"
                style={{ gridTemplateColumns: GRID }}
                onClick={() => router.push(`/inventory/stock-journals/${r.id}`)}
              >
                <div className="min-w-0 py-3">
                  <Link
                    href={`/inventory/stock-journals/${r.id}`}
                    className="font-semibold text-accent-ink hover:underline"
                    data-testid="sj-open"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.entryNo ?? "(draft)"}
                  </Link>
                  <div className="text-[11px] text-muted-foreground">{MODE_LABEL[r.mode]}</div>
                </div>
                <div className="py-3 text-[12.5px] tabular-nums text-muted-foreground">{formatDate(r.voucherDate)}</div>
                <div className="py-3 text-[13px]">{MODE_LABEL[r.mode]}</div>
                <div className="py-3"><StatusBadge status={r.status} /></div>
                <div className="py-3 text-[13px] [overflow-wrap:anywhere]">{godownName(maps, r.fromGodownId)}</div>
                <div className="py-3 text-[13px] [overflow-wrap:anywhere]">{godownName(maps, r.toGodownId)}</div>
                <div className="min-w-0 py-3 text-[13px] [overflow-wrap:anywhere]">{it.name}</div>
                <div className={cn("py-3 text-right", MONEY)}>{formatQty(r.quantity)} {it.uom}</div>
                <div className="py-3 text-right">{r.value ? <span className={MONEY}>{formatMoney(r.value)}</span> : <span className="text-faint">—</span>}</div>
                <div className="py-3 text-[13px] [overflow-wrap:anywhere]">{r.approvedById ? (maps.users.get(r.approvedById)?.name ?? "—") : "—"}</div>
                <div className="flex justify-end py-3" onClick={(e) => e.stopPropagation()}>
                  <RowMenu row={r} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* <lg cards (site-facing ≥360) */}
      <div className="flex flex-col lg:hidden">
        {rows.map((r) => {
          const it = itemLabel(maps, r.itemId);
          return (
            <Link
              key={r.id}
              href={`/inventory/stock-journals/${r.id}`}
              data-testid={`sj-card-${r.status}`}
              className="border-b border-muted px-4 py-3 hover:bg-surface-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-accent-ink">{r.entryNo ?? "(draft)"}</span>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-1 text-[12.5px] text-muted-foreground">
                {MODE_LABEL[r.mode]} · {godownName(maps, r.fromGodownId)} → {godownName(maps, r.toGodownId)} · {formatDate(r.voucherDate)}
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2 text-[13px]">
                <span className="[overflow-wrap:anywhere]">{it.name}</span>
                <span className="whitespace-nowrap font-mono tabular-nums">
                  {formatQty(r.quantity)} {it.uom}
                  {r.value ? ` · ${formatMoney(r.value)}` : ""}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function RowMenu({ row }: { row: StockJournal }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Row actions"
        data-testid="sj-row-menu"
        className="grid h-7 w-7 place-items-center rounded-token text-faint outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]">
        <DropdownMenuItem asChild>
          <Link href={`/inventory/stock-journals/${row.id}`}>Open</Link>
        </DropdownMenuItem>
        {row.journalEntryId && (
          <DropdownMenuItem asChild>
            <Link href={`/ledger/entry-viewer?id=${row.journalEntryId}`}>Go to ledger entry</Link>
          </DropdownMenuItem>
        )}
        {row.entryNo && (
          <DropdownMenuItem onSelect={() => navigator.clipboard?.writeText(row.entryNo as string)}>
            Copy entry no
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
