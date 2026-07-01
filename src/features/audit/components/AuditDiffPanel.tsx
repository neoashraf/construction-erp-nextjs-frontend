"use client";

import { X, Info, AlertCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetBody } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { asApiError } from "@/lib/api/errors";
import { useAuditLogDetail } from "../hooks/use-audit-logs";
import { buildAuditDiff, formatDiffValue } from "../lib/diff";
import { ActionBadge } from "./ActionBadge";
import { CopyableEntityId } from "./CopyableEntityId";
import { SealDisplay } from "./SealDisplay";

/**
 * Before/after diff detail panel (FR-AUD-020/021/022/024; spec §5/§6/§9/§13). Opens
 * from a row (`GET /api/audit-logs/:id`) as a side panel at >=1024, full-width at
 * >=768 (the parent screen controls the width via `className`; this component is
 * agnostic and works either way). CREATE shows only `after` with "Created — no
 * previous value.", DELETE shows only `before` with "Deleted — no new value.",
 * everything else shows a two-column before/after per changed/unchanged field.
 * The seal is DISPLAY ONLY (no verify control, no broken-seal state — SRS §16).
 * Read-only end to end: no edit/delete/correct/verify affordance exists here.
 */
export function AuditDiffPanel({
  id,
  projectId = null,
  asSheet = true,
  onClose,
}: {
  id: string;
  /**
   * The list row's `projectId`, when the panel opened from a visible row — the
   * detail endpoint (`GET /api/audit-logs/:id`) does not itself return a
   * `projectId` (confirmed against the merged backend `findById` projection), so
   * a deep-linked open (no list row in hand) simply shows "—" for Project.
   */
  projectId?: string | null;
  /** Side-panel Sheet (desktop) vs an inline full-width block (tablet). */
  asSheet?: boolean;
  onClose: () => void;
}) {
  const query = useAuditLogDetail(id);
  const entry = query.data;

  const notFound = query.isError && asApiError(query.error).code === "NOT_FOUND";

  const body = (
    <div data-testid="audit-diff-body">
      {query.isLoading ? (
        <div className="flex flex-col gap-3" data-testid="audit-diff-loading">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : query.isError ? (
        <EmptyState
          icon={AlertCircle}
          title={notFound ? "That audit entry doesn't exist." : "Couldn't load this entry."}
          action={
            notFound ? undefined : (
              <Button size="sm" onClick={() => query.refetch()} data-testid="audit-diff-retry">
                Retry
              </Button>
            )
          }
        />
      ) : entry ? (
        <div className="flex flex-col gap-4" data-testid="audit-diff-loaded">
          {/* header meta */}
          <div>
            <div className="flex items-center gap-2">
              <ActionBadge action={entry.action} />
              <span className="text-[13px] font-semibold text-foreground">{entry.entityType}</span>
            </div>
            <div className="mt-1.5">
              <CopyableEntityId id={entry.entityId} />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border pt-3">
            <MetaField
              label="Actor"
              value={entry.userName || entry.userId}
              mono={!entry.userName}
            />
            <MetaField label="Timestamp" value={formatDateTime(entry.createdAt)} mono />
            <MetaField label="Project" value={projectId ?? "—"} mono={!!projectId} />
            <MetaField label="IP address" value={entry.ipAddress ?? "—"} mono={!!entry.ipAddress} />
          </dl>

          <DiffBody entry={entry} />

          <SealDisplay seal={entry.seal} />
        </div>
      ) : null}
    </div>
  );

  if (!asSheet) {
    return (
      <div
        className="rounded-card border border-border bg-surface p-4"
        data-testid="audit-diff-inline"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-foreground">Entry detail</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-faint hover:text-foreground"
            data-testid="audit-diff-close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {body}
      </div>
    );
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[372px]" data-testid="audit-diff-panel">
        <SheetHeader kicker="Audit entry" title="Entry detail" />
        <SheetBody>{body}</SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function MetaField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.4px] text-faint">{label}</dt>
      <dd
        className={cn("mt-0.5 truncate text-[12.5px] text-foreground", mono && "font-mono")}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function DiffBody({ entry }: { entry: Parameters<typeof buildAuditDiff>[0] & { action: string } }) {
  const diff = buildAuditDiff(entry);

  return (
    <div className="border-t border-border pt-3.5" data-testid="audit-diff-fields">
      {diff.mode === "create" && <NoteBanner tone="info" text="Created — no previous value." />}
      {diff.mode === "delete" && <NoteBanner tone="destructive" text="Deleted — no new value." />}

      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Field changes
        </span>
        {diff.mode === "both" && (
          <Badge tone="info" data-testid="audit-diff-changed-count">
            {diff.fields.filter((f) => f.changed).length} changed
          </Badge>
        )}
      </div>

      {diff.fields.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">
          No field data recorded for this entry.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {diff.fields.map((f) => (
            <div
              key={f.field}
              className={cn(
                "rounded-token border p-2.5",
                f.changed ? "border-info/40 bg-info-soft/40" : "border-border bg-surface-2",
              )}
              data-testid={`audit-diff-field-${f.field}`}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11.5px] font-semibold text-foreground">{f.field}</span>
                {f.changed ? (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-info-ink">
                    ⇄ Changed
                  </span>
                ) : (
                  <span className="text-[10.5px] text-faint">· unchanged</span>
                )}
              </div>
              <div
                className={cn(
                  "grid gap-2 text-[12px]",
                  diff.mode === "both" ? "grid-cols-2" : "grid-cols-1",
                )}
              >
                {diff.mode !== "create" && (
                  <div>
                    {diff.mode === "both" && (
                      <div className="text-[10px] uppercase tracking-[0.4px] text-faint">
                        Before
                      </div>
                    )}
                    <div
                      className={cn(
                        "mt-0.5 break-words",
                        f.changed
                          ? "text-faint line-through decoration-border-strong"
                          : "text-foreground",
                      )}
                    >
                      {formatDiffValue(f.before)}
                    </div>
                  </div>
                )}
                {diff.mode !== "delete" && (
                  <div>
                    {diff.mode === "both" && (
                      <div className="text-[10px] uppercase tracking-[0.4px] text-faint">After</div>
                    )}
                    <div
                      className={cn(
                        "mt-0.5 break-words",
                        f.changed ? "font-semibold text-foreground" : "text-foreground",
                      )}
                    >
                      {formatDiffValue(f.after)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NoteBanner({ tone, text }: { tone: "info" | "destructive"; text: string }) {
  return (
    <div
      className={cn(
        "mb-3 flex items-center gap-2 rounded-token px-3 py-2 text-[12.5px]",
        tone === "info" ? "bg-info-soft text-info-ink" : "bg-destructive-soft text-destructive-ink",
      )}
      data-testid="audit-diff-note"
    >
      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {text}
    </div>
  );
}
