"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { PackageOpen } from "lucide-react";
import { useOnline } from "@/lib/hooks/use-online";
import { asApiError } from "@/lib/api";
import { useMatch } from "../hooks/useMatch";
import { useProjectOptions, useSupplierOptions, useItemOptions } from "../hooks/usePoOptions";
import { PurchaseStatusBadge } from "./PurchaseStatusBadge";
import { MatchTable } from "./MatchTable";
import { type ItemOption } from "../types";

/**
 * PO → Bill → GRN match view (brief §Scope 8; spec §4/§6/§10). Read-only per PO
 * line reconciliation of ordered vs billed vs received vs open + a per-line match
 * badge. Bound to `GET /purchase/orders/{id}/match`; no mutation. Full state
 * matrix: default · loading · empty (no lines) · error (404 / 5xx) ·
 * permission-denied (PM outside project) · offline (last-loaded banner).
 */
export function MatchView({ poId }: { poId: string }) {
  const router = useRouter();
  const online = useOnline();
  const query = useMatch(poId);
  const projectsData = useProjectOptions().data;
  const suppliersData = useSupplierOptions().data;
  const itemsData = useItemOptions().data;
  const projects = projectsData ?? [];
  const suppliers = suppliersData ?? [];
  const itemMap = useMemo(
    () => new Map<string, ItemOption>((itemsData ?? []).map((i) => [i.id, i])),
    [itemsData],
  );

  const data = query.data;
  const projectLabel = data
    ? (() => {
        const p = projects.find((x) => x.id === data.projectId);
        if (!p) return "(project unavailable)";
        return p.projectCode ? `${p.projectCode} — ${p.name}` : p.name;
      })()
    : "";
  const supplierLabel = data
    ? suppliers.find((s) => s.id === data.supplierId)?.name ?? "(supplier unavailable)"
    : "";

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-6xl" data-testid="match-loading">
        <Breadcrumb items={[{ label: "Purchase" }, { label: "PO Bill match" }, { label: poId }]} />
        <div className="mb-4 mt-1 flex flex-col gap-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Card className="flex flex-col gap-3 p-5">
          <Skeleton className="h-16 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </Card>
      </div>
    );
  }

  if (query.isError) {
    const e = asApiError(query.error);
    const forbidden = e.code === "FORBIDDEN";
    const notFound = e.code === "NOT_FOUND";
    const title = forbidden
      ? "You don't have access to this purchase order's match view."
      : notFound
        ? "This purchase order doesn't exist or isn't in your company."
        : "Couldn't load the match data. Please try again.";
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={[{ label: "Purchase" }, { label: "PO Bill match" }, { label: poId }]} />
        <Alert
          tone="destructive"
          title={title}
          className="mt-4"
          data-testid={forbidden ? "match-403" : notFound ? "match-404" : "match-error"}
        >
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => router.push("/purchase/grn")}>
              Back
            </Button>
            {!forbidden && !notFound && (
              <Button size="sm" onClick={() => query.refetch()} data-testid="match-retry">
                Retry
              </Button>
            )}
          </div>
        </Alert>
      </div>
    );
  }

  if (!data) return null;
  const title = data.poRefNo ?? poId;

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Purchase" }, { label: "PO Bill match" }, { label: title }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold tracking-[-0.02em]" data-testid="match-title">
          PO / Bill match — {title}
        </h1>
        <span
          className="inline-flex items-center gap-1 rounded-pill bg-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-muted-foreground"
          aria-label="Read-only view"
        >
          Read-only
        </span>
      </div>

      {!online && (
        <Alert
          tone="warning"
          className="mb-3"
          title="You're offline. Showing the last loaded match data."
          data-testid="match-offline"
        >
          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            Drill-down links are disabled until you reconnect.
          </span>
        </Alert>
      )}

      <Card
        className="mb-4 grid gap-3 p-4 md:grid-cols-4"
        data-testid="match-header"
      >
        <HeaderCell label="PO reference" value={data.poRefNo ?? "Draft"} />
        <HeaderCell label="Supplier" value={supplierLabel} />
        <HeaderCell label="Project" value={projectLabel} />
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.4px] text-faint">PO status</div>
          <PurchaseStatusBadge status={data.status} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {data.lines.length === 0 ? (
          <div className="p-8" data-testid="match-empty">
            <EmptyState
              icon={PackageOpen}
              title="This purchase order has no lines to match."
              description="There's nothing to reconcile yet — add lines to the purchase order first."
            />
          </div>
        ) : (
          <>
            <div
              className="flex items-center justify-between border-b border-muted bg-surface-2 px-4 py-2 text-[11.5px] text-muted-foreground"
              data-testid="match-header-band"
            >
              <span>Three-way match</span>
              <span>
                {data.lines.length} line{data.lines.length === 1 ? "" : "s"} · totals reflect
                posted vouchers only
              </span>
            </div>
            <MatchTable lines={data.lines} items={itemMap} poId={data.poId} />
          </>
        )}
      </Card>

      <div className="mt-4 flex justify-end">
        <Button variant="outline" size="md" onClick={() => router.back()} data-testid="match-back">
          Back
        </Button>
      </div>
    </div>
  );
}

function HeaderCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-[0.4px] text-faint">{label}</div>
      <div className="text-[14px] font-semibold text-foreground [overflow-wrap:anywhere]">
        {value}
      </div>
    </div>
  );
}
