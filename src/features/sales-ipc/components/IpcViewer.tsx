"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ExternalLink, Lock, Printer, Repeat, Search, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { asApiError } from "@/lib/api/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { useMasterLookups } from "@/lib/masters/lookups";
import { canCancelIpc } from "../access";
import { useIpcViewer } from "../hooks/useIpcViewer";
import { IpcStatusBadge } from "./IpcStatusBadge";
import { IpcKeyFigures } from "./IpcKeyFigures";
import { IpcLedgerLinesTable } from "./IpcLedgerLinesTable";
import { IpcLinkagePanel } from "./IpcLinkagePanel";
import { type Ipc } from "../types";

/**
 * IPC viewer — read-only detail screen for one POSTED/CANCELLED IPC (spec §4/§6;
 * FR-SAL-010/-012/-016/-021/-022; brief §5). Two bound surfaces: the on-screen viewer
 * (this component) and the RPT-produced Mushak print (`/print` sub-route). STRICTLY
 * READ-ONLY — no in-place edit/cancel/repost anywhere; Correct/Cancel are navigation
 * links to the editor's permissioned actions (Accounts/Admin only). A DRAFT id
 * redirects to the editor; a missing id renders the 404 state.
 */
export function IpcViewer({ ipcId }: { ipcId: string }) {
  const router = useRouter();
  const online = useOnline();
  const user = useAuthenticatedUser();
  const canCancel = canCancelIpc(user);
  const lookups = useMasterLookups();

  const { ipc: ipcQuery, entry: entryQuery } = useIpcViewer(ipcId);
  const ipc = ipcQuery.data;

  // DRAFT id → send to the editor (viewer is only for POSTED/CANCELLED, brief §5.1).
  useEffect(() => {
    if (ipc?.status === "DRAFT") {
      router.replace(`/sales/ipcs/${ipc.id}`);
    }
  }, [ipc?.id, ipc?.status, router]);

  const err = ipcQuery.isError ? asApiError(ipcQuery.error) : null;
  const notFound = err?.code === "NOT_FOUND" || err?.status === 404;
  const forbidden = err?.code === "FORBIDDEN" || err?.status === 403;
  const otherError = ipcQuery.isError && !notFound && !forbidden;

  const entryErr = entryQuery.isError ? asApiError(entryQuery.error) : null;
  const linesErrCode: "FORBIDDEN" | "OTHER" | null = entryErr
    ? entryErr.code === "FORBIDDEN" || entryErr.status === 403
      ? "FORBIDDEN"
      : "OTHER"
    : null;

  const goBack = () => router.push("/sales/ipcs");

  // ── Loading ──
  if (ipcQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={[{ label: "Sales / IPC Billing" }, { label: "IPC list", href: "/sales/ipcs" }, { label: "IPC" }]} />
        <div className="mb-3 mt-1 flex items-center gap-3">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-6 w-20 rounded-pill" />
        </div>
        <Skeleton className="mt-3 h-11 w-full" />
        <Card className="mt-4 flex flex-wrap gap-6 p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          ))}
        </Card>
        <Card className="mt-4 flex overflow-hidden p-0" data-testid="ipc-viewer-loading">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col gap-2 p-4">
              <Skeleton className="h-2.5 w-3/5" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </Card>
        <Card className="mt-4 overflow-hidden p-0">
          <div className="h-11 bg-surface-2" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-5 border-t border-muted p-4">
              <Skeleton className="h-2.5 w-4" />
              <Skeleton className="h-3 flex-[2.2]" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </Card>
      </div>
    );
  }

  // ── 404 ──
  if (notFound) {
    return (
      <ViewerShell breadcrumb={["Sales / IPC Billing", "IPC list"]}>
        <Card className="mt-6 p-10" data-testid="ipc-not-found">
          <EmptyState
            icon={Search}
            title="IPC not found"
            description="This IPC doesn't exist or isn't in your company."
            action={
              <Button size="md" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
            }
          />
        </Card>
      </ViewerShell>
    );
  }

  // ── 403 ──
  if (forbidden) {
    return (
      <ViewerShell breadcrumb={["Sales / IPC Billing", "IPC list"]}>
        <Card className="mt-6 p-10" data-testid="ipc-forbidden">
          <EmptyState
            icon={Lock}
            title="You don't have access to this IPC."
            description="If you're a project manager, you can only view IPCs on your assigned projects."
            action={
              <Button size="md" variant="outline" onClick={goBack}>
                Back
              </Button>
            }
          />
        </Card>
      </ViewerShell>
    );
  }

  // ── Other error ──
  if (otherError) {
    return (
      <ViewerShell breadcrumb={["Sales / IPC Billing", "IPC list"]}>
        <Card className="mt-6 p-10" data-testid="ipc-viewer-error">
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load this IPC. Please try again."
            description="Check your connection and retry."
            action={
              <Button size="md" onClick={() => ipcQuery.refetch()} data-testid="ipc-viewer-retry">
                Retry
              </Button>
            }
          />
        </Card>
      </ViewerShell>
    );
  }

  // Defensive fallback while the DRAFT redirect is running.
  if (!ipc || ipc.status === "DRAFT") return null;

  return (
    <div className="mx-auto max-w-6xl" data-testid="ipc-viewer">
      <Breadcrumb
        items={[
          { label: "Sales / IPC Billing" },
          { label: "IPC list", href: "/sales/ipcs" },
          { label: ipc.entryNo ?? `IPC #${ipc.ipcSeqNo}` },
        ]}
      />

      {/* Title row */}
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-[23px] font-bold tracking-[-0.01em] text-foreground" data-testid="ipc-viewer-title">
          IPC <span>{ipc.entryNo ?? `#${ipc.ipcSeqNo}`}</span>
        </h1>
        <IpcStatusBadge status={ipc.status} />
      </div>

      {!online && (
        <Alert tone="warning" title="You're offline." className="mt-3" data-testid="ipc-viewer-offline">
          Showing the last loaded IPC. Print and &ldquo;View in ledger&rdquo; are disabled until you reconnect.
        </Alert>
      )}

      {/* Immutability note */}
      <div className="mt-3 flex items-start gap-3 rounded-card border border-accent-soft bg-accent-soft/40 p-3" data-testid="ipc-immutability-note">
        <Lock className="mt-0.5 h-4 w-4 flex-none text-accent-ink" aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Posted IPCs can&rsquo;t be edited. To correct this, use{" "}
          {canCancel ? (
            <Link href={`/sales/ipcs/${ipc.id}`} className="font-semibold text-accent-ink hover:underline">
              Correct this IPC
            </Link>
          ) : (
            <span className="font-semibold text-foreground">Correct this IPC</span>
          )}{" "}
          (reverse-and-repost) or{" "}
          {canCancel ? (
            <Link href={`/sales/ipcs/${ipc.id}`} className="font-semibold text-accent-ink hover:underline">
              Cancel this IPC
            </Link>
          ) : (
            <span className="font-semibold text-foreground">Cancel this IPC</span>
          )}
          .
        </p>
      </div>

      {/* Header block */}
      <Card className="mt-4 overflow-hidden" data-testid="ipc-header-block">
        <div className="flex flex-wrap items-start gap-6 p-5">
          <HeaderField label="Project" value={lookups.project(ipc.projectId) || ipc.projectId} minWidth={150} />
          <HeaderField
            label="Customer"
            value={lookups.party(ipc.customerId) || `${ipc.customerId.slice(0, 8)} (name unavailable)`}
            minWidth={170}
            maxWidth={230}
            bn
          />
          <div className="flex flex-wrap gap-5">
            <HeaderField label="IPC date" value={formatDate(ipc.ipcDate)} mono />
            <HeaderField label="Bill date" value={formatDate(ipc.billDate)} mono />
            <HeaderField label="Due date" value={formatDate(ipc.dueDate)} mono />
            <HeaderField label="Work completed" value={`${trimPct(ipc.workCompletedPct)}%`} strong mono />
          </div>
          <div className="ml-auto flex flex-col items-end gap-0.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Posted</span>
            <span className="font-mono text-[13.5px] tabular-nums text-foreground" data-testid="ipc-posted-at">
              {ipc.postedAt ? formatDateTime(ipc.postedAt) : "—"}
            </span>
            <span className="bn text-[12.5px] text-muted-foreground">
              by {ipc.postedBy ? lookups.party(ipc.postedBy) || ipc.postedBy : "—"}
            </span>
          </div>
        </div>
      </Card>

      {/* Key figures */}
      <IpcKeyFigures ipc={ipc} />

      {/* Cancelled superseded ribbon */}
      {ipc.status === "CANCELLED" ? (
        <CancelledRibbon ipc={ipc} />
      ) : null}

      {/* Ledger lines */}
      <IpcLedgerLinesTable
        entry={entryQuery.data}
        isLoading={entryQuery.isLoading}
        errorCode={linesErrCode}
        ledgerHref={ipc.journalEntryId ? `/ledger/entry-viewer?id=${ipc.journalEntryId}` : null}
        onRetry={() => entryQuery.refetch()}
      />

      {/* Linkage panel — only when hasHistory */}
      <IpcLinkagePanel
        linkage={ipc.linkage}
        ipcHrefForEntry={(entryId) => `/ledger/entry-viewer?id=${entryId}`}
      />

      {/* Action bar */}
      <div className="mt-6 mb-8 flex flex-wrap items-center gap-2.5" data-testid="ipc-viewer-actions">
        <Button variant="outline" onClick={goBack} data-testid="ipc-viewer-back">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Button>
        {ipc.journalEntryId ? (
          <Button variant="outline" asChild disabled={!online}>
            <Link href={`/ledger/entry-viewer?id=${ipc.journalEntryId}`} data-testid="ipc-viewer-view-in-ledger">
              <ExternalLink className="h-4 w-4" aria-hidden />
              View in ledger
            </Link>
          </Button>
        ) : null}
        {canCancel && ipc.status === "POSTED" ? (
          <>
            <span className="mx-1 h-6 w-px bg-border-strong" aria-hidden />
            <Button variant="outline" asChild data-testid="ipc-viewer-correct">
              <Link href={`/sales/ipcs/${ipc.id}`}>
                <Repeat className="h-4 w-4" aria-hidden />
                Correct this IPC
              </Link>
            </Button>
            <Button variant="outline" asChild className="border-destructive/40 text-destructive-ink hover:bg-destructive-soft" data-testid="ipc-viewer-cancel">
              <Link href={`/sales/ipcs/${ipc.id}`}>
                <XCircle className="h-4 w-4" aria-hidden />
                Cancel this IPC
              </Link>
            </Button>
          </>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Button asChild disabled={!online} data-testid="ipc-viewer-print">
            <a href={`/sales/ipcs/${ipc.id}/view/print`} target="_blank" rel="noopener">
              <Printer className="h-4 w-4" aria-hidden />
              Print
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function CancelledRibbon({ ipc }: { ipc: Ipc }) {
  const reversalNo = ipc.linkage?.entries.find((e) => e.isReversal)?.entryNo;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-card border border-border-strong bg-muted p-3.5" data-testid="ipc-cancelled-ribbon">
      <span className="inline-flex h-6 items-center gap-1.5 rounded-pill bg-border-strong px-2.5 text-[11px] font-bold uppercase tracking-[0.3px] text-muted-foreground">
        Superseded
      </span>
      <span className="text-[12.5px] text-muted-foreground">
        This certificate was cancelled
        {reversalNo ? (
          <>
            {" "}and reversed by{" "}
            <span className="font-mono font-semibold text-info-ink">{reversalNo}</span>
          </>
        ) : null}
        . The ledger lines below are the original posting, retained for audit.
      </span>
    </div>
  );
}

function HeaderField({
  label,
  value,
  minWidth,
  maxWidth,
  strong,
  mono,
  bn,
}: {
  label: string;
  value: string;
  minWidth?: number;
  maxWidth?: number;
  strong?: boolean;
  mono?: boolean;
  bn?: boolean;
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-1"
      style={{
        minWidth: minWidth ? `${minWidth}px` : undefined,
        maxWidth: maxWidth ? `${maxWidth}px` : undefined,
      }}
    >
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">{label}</span>
      <span
        className={
          "text-[14px] leading-snug text-foreground [overflow-wrap:anywhere] " +
          (strong ? "font-semibold " : "") +
          (mono ? "font-mono tabular-nums " : "") +
          (bn ? "bn " : "")
        }
      >
        {value || "—"}
      </span>
    </div>
  );
}

function ViewerShell({ children, breadcrumb }: { children: React.ReactNode; breadcrumb: string[] }) {
  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb
        items={breadcrumb.map((label, i) =>
          i === breadcrumb.length - 1 ? { label } : { label, href: label.includes("list") ? "/sales/ipcs" : undefined },
        )}
      />
      {children}
    </div>
  );
}

function trimPct(v: string): string {
  if (!v.includes(".")) return v;
  const trimmed = v.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed || "0";
}
