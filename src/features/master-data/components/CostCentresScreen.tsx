"use client";

import { useState } from "react";
import { Layers, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { useCostCentres } from "../hooks/useCostCentres";
import { type CostCentre } from "../types";
import { CostCentresTable } from "./CostCentresTable";
import { CostCentreFormModal } from "./CostCentreFormModal";
import { CostCentreStatusDialog } from "./CostCentreStatusDialog";

type Modal = { kind: "create" } | { kind: "edit"; centre: CostCentre } | null;

/** Cost centres screen (FR-MAS-009/010/029/033). List + add/rename + deactivate/reactivate. */
export function CostCentresScreen() {
  const session = useSession();
  // Permission-driven (FE-21): UPDATE grant admits managing; Admin always has it. Backend re-checks.
  const canManage = session ? hasGrant(session, "master_data.cost_centres", "UPDATE") : false;
  const { toast } = useToast();

  // Draft filter state (edited freely) vs applied (drives the query) — Apply commits,
  // matching the design's filter bar.
  const [draftActiveOnly, setDraftActiveOnly] = useState(true);
  const [draftQ, setDraftQ] = useState("");
  const [applied, setApplied] = useState<{ activeOnly: boolean; q: string }>({
    activeOnly: true,
    q: "",
  });
  const [modal, setModal] = useState<Modal>(null);
  const [statusTarget, setStatusTarget] = useState<{
    centre: CostCentre;
    mode: "deactivate" | "reactivate";
  } | null>(null);

  const query = useCostCentres({
    isActive: applied.activeOnly ? true : undefined,
    q: applied.q || undefined,
  });
  const rows = query.data?.data ?? [];
  const hasFilters = applied.q !== "" || !applied.activeOnly;

  function applyFilters() {
    setApplied({ activeOnly: draftActiveOnly, q: draftQ.trim() });
  }
  function clearFilters() {
    setDraftActiveOnly(true);
    setDraftQ("");
    setApplied({ activeOnly: true, q: "" });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: "Master Data" }, { label: "Cost centres" }]} />
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Cost centres</h1>
        </div>
        {canManage && (
          <Button
            size="md"
            onClick={() => setModal({ kind: "create" })}
            className="flex-none"
            data-testid="new-cost-centre"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New cost centre
          </Button>
        )}
      </div>

      {/* FILTER BAR (design: white card · Status toggle · Search + Apply/Clear) */}
      <Card className="mt-4 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters();
          }}
          className="flex flex-wrap items-end gap-3.5"
        >
          <div className="flex flex-none flex-col gap-1.5">
            <Label id="cc-status-label">Status</Label>
            <div
              role="group"
              aria-labelledby="cc-status-label"
              className="flex h-9 gap-0.5 rounded-token bg-muted p-0.5"
            >
              {[
                { key: true, label: "Active" },
                { key: false, label: "All" },
              ].map((o) => (
                <button
                  key={String(o.key)}
                  type="button"
                  aria-pressed={draftActiveOnly === o.key}
                  onClick={() => setDraftActiveOnly(o.key)}
                  className={cn(
                    "rounded-sm px-4 text-[12.5px] font-semibold transition-colors",
                    draftActiveOnly === o.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
            <Label htmlFor="cc-search">Search</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                aria-hidden
              />
              <Input
                id="cc-search"
                type="search"
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                placeholder="Search by code or name"
                aria-label="Search cost centres"
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex items-end gap-2">
            <Button type="submit" size="md" data-testid="cc-apply">
              Apply
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={clearFilters} data-testid="cc-clear-filters">
              Clear filters
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mt-4 overflow-hidden p-0">
        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="cc-loading">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load cost centres.">
              <div className="flex flex-col items-start gap-2">
                <span>The server returned an error. Check your connection and try again.</span>
                <Button size="sm" onClick={() => query.refetch()} data-testid="cc-retry">
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          hasFilters ? (
            <div className="p-8">
              <EmptyState
                icon={Search}
                title="No cost centres match these filters."
                description="Try a different status or search term."
                action={
                  <Button size="md" variant="outline" onClick={clearFilters} data-testid="cc-clear">
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="p-8">
              <EmptyState
                icon={Layers}
                title="No cost centres found."
                description="The standard 14 are normally seeded at go-live. Add a cost centre to start budgeting against it."
                action={
                  canManage ? (
                    <Button
                      size="md"
                      onClick={() => setModal({ kind: "create" })}
                      data-testid="empty-new-cc"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      New cost centre
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )
        ) : (
          <CostCentresTable
            centres={rows}
            canManage={canManage}
            onRename={(c) => setModal({ kind: "edit", centre: c })}
            onDeactivate={(c) => setStatusTarget({ centre: c, mode: "deactivate" })}
            onReactivate={(c) => setStatusTarget({ centre: c, mode: "reactivate" })}
          />
        )}
      </Card>

      {modal && (
        <CostCentreFormModal
          mode={modal.kind === "edit" ? { kind: "edit", centre: modal.centre } : { kind: "create" }}
          onClose={() => setModal(null)}
          onSuccess={(m) => toast(m, "success")}
          onConflict={() => {
            setModal(null);
            toast("This cost centre was changed by someone else. Reload and try again.", "error");
            query.refetch();
          }}
          onError={(m) => toast(m, "error")}
        />
      )}

      <CostCentreStatusDialog
        centre={statusTarget?.centre ?? null}
        mode={statusTarget?.mode ?? "deactivate"}
        onClose={() => setStatusTarget(null)}
        onReload={() => query.refetch()}
      />
    </div>
  );
}
