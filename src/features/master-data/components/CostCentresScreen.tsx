"use client";

import { useEffect, useState } from "react";
import { Layers, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const [activeOnly, setActiveOnly] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [statusTarget, setStatusTarget] = useState<{
    centre: CostCentre;
    mode: "deactivate" | "reactivate";
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const query = useCostCentres({
    isActive: activeOnly ? true : undefined,
    q: debouncedQ || undefined,
  });
  const rows = query.data?.data ?? [];
  const hasFilters = debouncedQ !== "";

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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Filter by status"
          className="flex gap-0.5 rounded-token border border-border bg-muted p-0.5"
        >
          {[
            { key: true, label: "Active" },
            { key: false, label: "All" },
          ].map((o) => (
            <button
              key={String(o.key)}
              type="button"
              aria-pressed={activeOnly === o.key}
              onClick={() => setActiveOnly(o.key)}
              className={cn(
                "rounded-sm px-4 py-1.5 text-[12.5px] font-semibold transition-colors",
                activeOnly === o.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-[280px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code or name…"
            aria-label="Search cost centres"
            className="pl-9"
          />
        </div>
      </div>

      <Card className="mt-3.5 overflow-hidden p-3 sm:p-4">
        {query.isLoading ? (
          <div className="flex flex-col gap-2" data-testid="cc-loading">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <Alert tone="destructive" title="Couldn't load cost centres.">
            <div className="flex flex-col items-start gap-2">
              <span>The server returned an error. Check your connection and try again.</span>
              <Button size="sm" onClick={() => query.refetch()} data-testid="cc-retry">
                Retry
              </Button>
            </div>
          </Alert>
        ) : rows.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={Search}
              title="No cost centres match these filters."
              action={
                <Button size="md" variant="outline" onClick={() => setQ("")} data-testid="cc-clear">
                  Clear
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Layers}
              title="No cost centres found."
              description="Cost centres tag every posting line and back project budgets."
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
