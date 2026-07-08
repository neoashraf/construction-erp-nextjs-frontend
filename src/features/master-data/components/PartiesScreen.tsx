"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { usePartiesList } from "../hooks/useParties";
import { type Party } from "../types";
import { PartyFilterBar, type RoleFilter } from "./PartyFilterBar";
import { PartiesTable } from "./PartiesTable";
import { PartyStatusDialog } from "./PartyStatusDialog";

const PAGE_SIZE = 25;

/** Parties list screen (FR-MAS-022/024/029/033). Filters/search/pagination + table. */
export function PartiesScreen() {
  const session = useSession();
  // Permission-driven (FE-21): UPDATE grant admits managing; Admin always has it. Backend re-checks.
  const canManage = session ? hasGrant(session, "master_data.parties", "UPDATE") : false;

  const [role, setRole] = useState<RoleFilter>("all");
  const [activeOnly, setActiveOnly] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [statusTarget, setStatusTarget] = useState<{
    party: Party;
    mode: "deactivate" | "reactivate";
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => setPage(1), [role, activeOnly, debouncedQ]);

  const query = usePartiesList({
    isCustomer: role === "customers" || undefined,
    isSupplier: role === "suppliers" || undefined,
    isActive: activeOnly ? true : undefined,
    q: debouncedQ || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const hasFilters = role !== "all" || debouncedQ !== "" || !activeOnly;
  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function clearFilters() {
    setRole("all");
    setActiveOnly(true);
    setQ("");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="mb-1.5 text-xs text-muted-foreground">
            Master Data <span className="text-border-strong">/</span>{" "}
            <span className="font-medium text-foreground">Parties</span>
          </nav>
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Parties</h1>
        </div>
        {canManage && (
          <Button size="md" asChild className="flex-none">
            <Link href="/master-data/parties/new" data-testid="new-party">
              <Plus className="h-4 w-4" aria-hidden />
              New party
            </Link>
          </Button>
        )}
      </div>

      <div className="mt-4">
        <PartyFilterBar
          role={role}
          onRole={setRole}
          activeOnly={activeOnly}
          onActiveOnly={setActiveOnly}
          q={q}
          onQ={setQ}
        />
      </div>

      <Card className="mt-3.5 overflow-hidden p-3 sm:p-4">
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
              icon={Users}
              title="No parties match these filters."
              action={
                <Button
                  size="md"
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
                  <Button size="md" asChild>
                    <Link href="/master-data/parties/new" data-testid="empty-new-party">
                      <Plus className="h-4 w-4" aria-hidden />
                      New party
                    </Link>
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
              onDeactivate={(party) => setStatusTarget({ party, mode: "deactivate" })}
              onReactivate={(party) => setStatusTarget({ party, mode: "reactivate" })}
            />
            <div className="mt-3 flex items-center justify-between border-t border-border px-1 pt-3">
              <span className="text-[12.5px] text-muted-foreground">
                {total} part{total === 1 ? "y" : "ies"}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
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

      <PartyStatusDialog
        party={statusTarget?.party ?? null}
        mode={statusTarget?.mode ?? "deactivate"}
        onClose={() => setStatusTarget(null)}
        onReload={() => query.refetch()}
      />
    </div>
  );
}
