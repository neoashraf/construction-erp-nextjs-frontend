"use client";

import { useState } from "react";
import { CalendarRange, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { useFinancialYears } from "../hooks/useFinancialYears";
import { type FinancialYear } from "../types";
import { FinancialYearsTable } from "./FinancialYearsTable";
import { FinancialYearFormModal } from "./FinancialYearFormModal";
import { SetActiveDialog } from "./SetActiveDialog";

type Modal = { kind: "create" } | { kind: "edit"; fy: FinancialYear } | null;
type Filter = "all" | "active";

/**
 * Financial-years manager screen (FR-MAS-002/003). Lists the company's FYs, hosts
 * the create/edit slide-over and the set-active confirm dialog, and drives the full
 * state matrix (loading / empty / error / data). Admin sees actions; other roles
 * read-only. Backend re-checks every mutation (defence-in-depth).
 */
export function FinancialYearsScreen() {
  const session = useSession();
  // Permission-driven (FE-21): the financial-years UPDATE grant admits managing (create/edit
  // FYs); Admin always has it. The list itself is viewable by anyone who reached the page.
  // Backend re-checks every write.
  const isAdmin = session ? hasGrant(session, "master_data.financial_years", "UPDATE") : false;
  const { toast } = useToast();

  const [filter, setFilter] = useState<Filter>("all");
  const [modal, setModal] = useState<Modal>(null);
  const [confirmFy, setConfirmFy] = useState<FinancialYear | null>(null);

  const query = useFinancialYears(filter === "active" ? { isActive: true } : {});

  const openCreate = () => setModal({ kind: "create" });
  const openEdit = (fy: FinancialYear) => setModal({ kind: "edit", fy });

  return (
    <div className="mx-auto max-w-6xl">
      {/* Breadcrumb + title + CTA */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="mb-1.5 text-xs text-muted-foreground">
            Master Data <span className="text-border-strong">/</span>{" "}
            <span className="font-medium text-foreground">Financial years</span>
          </nav>
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Financial years</h1>
        </div>
        {isAdmin ? (
          <Button size="md" onClick={openCreate} className="flex-none" data-testid="new-fy">
            <Plus className="h-4 w-4" aria-hidden />
            New financial year
          </Button>
        ) : null}
      </div>

      {/* Filter + note */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
            Show
          </span>
          <div
            role="group"
            aria-label="Filter financial years"
            className="flex gap-0.5 rounded-token border border-border bg-muted p-0.5"
          >
            {(["active", "all"] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-sm px-4 py-1.5 text-[12.5px] font-semibold capitalize transition-colors",
                  filter === key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
        <span className="text-[11.5px] text-faint">
          Exactly one financial year is active. Years may overlap.
        </span>
      </div>

      {/* Table card + state matrix */}
      <Card className="mt-3.5 overflow-hidden">
        {query.isLoading ? (
          <LoadingRows />
        ) : query.isError ? (
          <div className="p-8">
            <div className="flex flex-col items-center rounded-card border border-destructive/30 bg-destructive-soft px-5 py-11 text-center">
              <div className="grid h-13 w-13 place-items-center rounded-full bg-destructive-soft text-lg font-bold text-destructive-ink">
                !
              </div>
              <p className="mt-4 text-[15px] font-semibold text-foreground">
                Couldn&apos;t load financial years.
              </p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                The server returned an error. Check your connection and try again.
              </p>
              <Button
                size="md"
                className="mt-4"
                onClick={() => query.refetch()}
                data-testid="fy-retry"
              >
                Retry
              </Button>
            </div>
          </div>
        ) : query.data && query.data.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={CalendarRange}
              title="No financial years yet."
              description="Create the company's first financial year to start posting."
              action={
                isAdmin ? (
                  <Button size="md" onClick={openCreate} data-testid="empty-new-fy">
                    <Plus className="h-4 w-4" aria-hidden />
                    New financial year
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <FinancialYearsTable
            years={query.data ?? []}
            isAdmin={isAdmin}
            onEdit={openEdit}
            onSetActive={setConfirmFy}
          />
        )}
      </Card>

      {/* Create / edit slide-over */}
      {modal ? (
        <FinancialYearFormModal
          mode={modal.kind === "edit" ? { kind: "edit", fy: modal.fy } : { kind: "create" }}
          onClose={() => setModal(null)}
          onSuccess={(msg) => toast(msg, "success")}
          onConflict={() => {
            setModal(null);
            toast(
              "This financial year was changed by someone else. Reload and try again.",
              "error",
            );
            query.refetch();
          }}
          onError={(msg) => toast(msg, "error")}
        />
      ) : null}

      {/* Set-active confirm */}
      <SetActiveDialog
        fy={confirmFy}
        onClose={() => setConfirmFy(null)}
        onSuccess={(label) => toast(`‘${label}’ is now the active financial year.`, "success")}
        onError={(msg) => toast(msg, "error")}
      />
    </div>
  );
}

/** Skeleton table body while the list loads (spec §6 loading). */
function LoadingRows() {
  return (
    <div className="divide-y divide-border" data-testid="fy-loading">
      <div className="flex h-11 items-center bg-surface-2 px-4">
        <Skeleton className="h-3 w-16" />
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-8 px-4 py-3.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-14 rounded-pill" />
        </div>
      ))}
    </div>
  );
}
