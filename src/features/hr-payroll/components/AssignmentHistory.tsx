import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { type EmployeeAssignment } from "../types";

const isBn = (s: string) => /[ঀ-৿]/.test(s);

function safeDate(iso: string): string {
  try {
    return formatDate(iso);
  } catch {
    return iso;
  }
}

/**
 * Append-only assignment history (FR-HR-002; Employees.dc.html). A newest-first
 * timeline — each Reassign appends a row; nothing is edited or removed. The current
 * assignment is marked, and the joining row is tagged. Rendered as a dotted rail.
 */
export function AssignmentHistory({ assignments }: { assignments: EmployeeAssignment[] }) {
  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
          <span className="text-[13px] font-semibold text-foreground">Assignment history</span>
          <Badge tone="accent">Append-only</Badge>
          <span className="ml-auto text-xs text-faint">
            Newest first · entries are never edited or removed
          </span>
        </div>
        <ol className="px-4 pb-3.5 pt-1.5">
          {assignments.map((h, i) => {
            const last = i === assignments.length - 1;
            return (
              <li key={h.id} className="relative flex gap-3.5 pt-3.5">
                {/* rail */}
                <div className="flex w-[22px] flex-none flex-col items-center">
                  <span
                    className={cn(
                      "mt-1 h-2.5 w-2.5 flex-none rounded-full border-2",
                      h.isCurrent
                        ? "border-accent-soft bg-accent"
                        : "border-border bg-border-strong",
                    )}
                    aria-hidden
                  />
                  {!last && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
                </div>
                <div
                  className={cn(
                    "min-w-0 flex-1 pb-3.5",
                    !last && "border-b border-border",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-[12.5px] tabular-nums text-muted-foreground">
                      {safeDate(h.effectiveDate)}
                    </span>
                    <span className="text-border-strong" aria-hidden>
                      →
                    </span>
                    <span className="text-[13.5px] font-semibold text-foreground">
                      {h.projectName}
                    </span>
                    {h.isCurrent && <Badge tone="accent">Current</Badge>}
                    {h.isJoining && <Badge tone="neutral">Joining assignment</Badge>}
                  </div>
                  {h.note && (
                    <p
                      className={cn(
                        "mt-1 text-[12.5px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]",
                        isBn(h.note) && "font-sans",
                      )}
                    >
                      {h.note}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
      <p className="mt-3 text-xs text-faint">
        Reassign adds a new entry here — the prior assignment is kept, never overwritten (FR-HR-002).
      </p>
    </>
  );
}
