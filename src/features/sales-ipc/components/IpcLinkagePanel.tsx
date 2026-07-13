import Link from "next/link";
import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { type IpcLinkage, type IpcLinkageEntry } from "../types";

/**
 * IPC viewer correction-chain panel (spec §5/§8, FR-SAL-022; brief §5.5, G1). Bound to
 * the `linkage` object on `GET /api/sales/ipc/{id}` (**never** reconstructed from action
 * responses or a source-filtered ledger query). Renders **only when
 * `linkage.hasHistory`** — a normal posted IPC with no cancel/repost history has no
 * panel to show. Labels are composed from `linkage.entries` per the spec:
 *   • "Reversal of {`reversalOfEntryNo`}" — on the reversal entry itself,
 *   • "Reversed by {`reversedByEntryNo`}" — on the original that was superseded,
 *   • "Corrected as {`currentEntryNo`} (original {`originalEntryNo`} retained)" — on
 *     the original when a corrected repost replaced it.
 * Each row is a plain-text label + a link to the linked entry's viewer instance.
 */
export function IpcLinkagePanel({
  linkage,
  ipcHrefForEntry,
}: {
  linkage: IpcLinkage | null | undefined;
  ipcHrefForEntry: (entryId: string) => string;
}) {
  if (!linkage || !linkage.hasHistory) return null;

  const rows = linkage.entries.map((e) => describe(e, linkage));

  return (
    <section className="mt-4" data-testid="ipc-linkage">
      <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        Correction chain
      </h2>
      <div className={cn("mt-2 grid gap-3 md:grid-cols-2", rows.length === 1 && "md:grid-cols-1")}>
        {rows.map((r) => (
          <article
            key={r.entry.entryId}
            className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-sm"
            data-testid={`ipc-linkage-${r.kindSlug}`}
          >
            <span className={cn("grid h-[34px] w-[34px] flex-none place-items-center rounded-token", r.iconBg)}>
              <Repeat className={cn("h-4 w-4", r.iconInk)} aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.4px] text-faint">{r.kind}</div>
              <Link
                href={ipcHrefForEntry(r.entry.entryId)}
                className="mt-0.5 inline-block font-mono text-[13.5px] font-semibold text-accent-ink hover:underline"
                aria-label={`${r.kind} entry ${r.title}`}
              >
                {r.title}
              </Link>
              {r.note ? <div className="mt-0.5 text-[11.5px] text-muted-foreground">{r.note}</div> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

interface DescribedRow {
  entry: IpcLinkageEntry;
  kind: string;
  kindSlug: string;
  title: string;
  note?: string;
  iconBg: string;
  iconInk: string;
}

function describe(entry: IpcLinkageEntry, linkage: IpcLinkage): DescribedRow {
  if (entry.isReversal) {
    return {
      entry,
      kind: "Reversal of",
      kindSlug: "reversal-of",
      title: entry.reversalOfEntryNo ?? entry.entryNo,
      note: "Reversal entry · negates the original posting",
      iconBg: "bg-warning-soft",
      iconInk: "text-warning-ink",
    };
  }
  if (entry.isCurrent && linkage.originalEntryNo && linkage.originalEntryNo !== entry.entryNo) {
    return {
      entry,
      kind: "Corrected as",
      kindSlug: "corrected-as",
      title: entry.entryNo,
      note: `original ${linkage.originalEntryNo} retained`,
      iconBg: "bg-info-soft",
      iconInk: "text-info-ink",
    };
  }
  if (entry.isReversed && entry.reversedByEntryNo) {
    return {
      entry,
      kind: "Reversed by",
      kindSlug: "reversed-by",
      title: entry.reversedByEntryNo,
      note: "This certificate was superseded",
      iconBg: "bg-muted",
      iconInk: "text-muted-foreground",
    };
  }
  return {
    entry,
    kind: "Original",
    kindSlug: "original",
    title: entry.entryNo,
    note: entry.isCurrent ? "Current, retained" : undefined,
    iconBg: "bg-success-soft",
    iconInk: "text-success-ink",
  };
}
