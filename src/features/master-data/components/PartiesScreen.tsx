"use client";

import { useEffect, useState } from "react";
import { Users, Search, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { usePartiesList } from "../hooks/useParties";
import { type Party } from "../types";
import { PartyFilterBar, type RoleFilter, type StatusFilter } from "./PartyFilterBar";
import { PartiesTable } from "./PartiesTable";
import { PartyFormSheet } from "./PartyFormSheet";
import { PartyStatusDialog } from "./PartyStatusDialog";

type FormTarget = { kind: "create" } | { kind: "edit"; party: Party };

const PAGE_SIZE = 25;

/** Parties list screen (FR-MAS-022/024/029/033). Filters/search/pagination + table. */
export function PartiesScreen() {
  const session = useSession();
  // Permission-driven (FE-21): UPDATE grant admits managing; Admin always has it. Backend re-checks.
  const canManage = session ? hasGrant(session, "master_data.parties", "UPDATE") : false;

  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  // `qDraft` is what the user types; `q` is the applied term (Apply / Enter commit it).
  const [qDraft, setQDraft] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [statusTarget, setStatusTarget] = useState<{
    party: Party;
    mode: "deactivate" | "reactivate";
  } | null>(null);

  // Reset to page 1 whenever an applied filter changes.
  useEffect(() => setPage(1), [role, status, q]);

  const query = usePartiesList({
    isCustomer: role === "customers" || undefined,
    isSupplier: role === "suppliers" || undefined,
    isActive: status === "active" ? true : undefined,
    q: q || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const hasFilters = role !== "all" || q !== "" || status !== "active";
  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(page * PAGE_SIZE, total);

  function applyFilters() {
    setQ(qDraft.trim());
  }

  function clearFilters() {
    setRole("all");
    setStatus("active");
    setQDraft("");
    setQ("");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: "Master Data" }, { label: "Parties" }]} />
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Parties</h1>
        </div>
        {canManage && (
          <Button
            className="h-[38px] flex-none px-4"
            onClick={() => setFormTarget({ kind: "create" })}
            data-testid="new-party"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New party
          </Button>
        )}
      </div>

      <div className="mt-4">
        <PartyFilterBar
          role={role}
          onRole={setRole}
          status={status}
          onStatus={setStatus}
          q={qDraft}
          onQ={setQDraft}
          onApply={applyFilters}
          onClear={clearFilters}
        />
      </div>

      <Card className="mt-4 overflow-hidden p-3 sm:p-4">
        {query.isLoading ? (
          <div className="flex flex-col gap-2" data-testid="parties-loading">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <Alert tone="destructive" title="Couldn't load parties.">
            <div className="flex flex-col items-start gap-2">
              <span>The server returned an error. Check your connection and try again.</span>
              <Button size="sm" onClick={() => query.refetch()} data-testid="parties-retry">
                Retry
              </Button>
            </div>
          </Alert>
        ) : rows.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={Search}
              title="No parties match these filters."
              description="Try a different role, status, or search term."
              action={
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  data-testid="clear-filters"
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No parties yet."
              description="Add customers and suppliers to use them in vouchers."
              action={
                canManage ? (
                  <Button
                    onClick={() => setFormTarget({ kind: "create" })}
                    data-testid="empty-new-party"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    New party
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <>
            <PartiesTable
              parties={rows}
              canManage={canManage}
              onEdit={(party) => setFormTarget({ kind: "edit", party })}
              onDeactivate={(party) => setStatusTarget({ party, mode: "deactivate" })}
              onReactivate={(party) => setStatusTarget({ party, mode: "reactivate" })}
            />
            <div className="mt-3 flex items-center justify-between border-t border-border px-1 pt-3">
              <span className="text-[12.5px] text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {rangeFrom}–{rangeTo}
                </span>{" "}
                of <span className="font-semibold text-foreground">{total}</span> part
                {total === 1 ? "y" : "ies"}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <span className="text-[12.5px] tabular-nums text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      {formTarget && (
        <PartyFormSheet
          mode={formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={() => query.refetch()}
          onReload={() => query.refetch()}
        />
      )}

      <PartyStatusDialog
        party={statusTarget?.party ?? null}
        mode={statusTarget?.mode ?? "deactivate"}
        onClose={() => setStatusTarget(null)}
        onReload={() => query.refetch()}
      />
    </div>
  );
}
