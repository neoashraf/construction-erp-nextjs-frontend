"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FolderKanban, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { useProjectsList } from "../hooks/useProjects";
import { usePartiesList } from "../hooks/useParties";
import { useUsers } from "../hooks/useUsers";
import { type ProjectStatus } from "../types";
import { ProjectsTable } from "./ProjectsTable";

const PAGE_SIZE = 25;
const STATUSES: ProjectStatus[] = ["PLANNED", "ACTIVE", "ON_HOLD", "CLOSED"];
const STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  CLOSED: "Closed",
};

/**
 * Projects list screen (FR-MAS-005/006; design file `Projects.dc.html`). A filter bar
 * (Status · Customer · PM · Search + Apply/Clear) drives the list; rows open the detail.
 * Filters are DRAFT until Apply (matching the design) — nothing re-queries mid-edit.
 */
export function ProjectsScreen() {
  const session = useSession();
  // Permission-driven (FE-21): CREATE admits creating, UPDATE the kebab's Edit. Admin has
  // both; a custom role granted them does too. Backend re-checks every write.
  const canCreate = session ? hasGrant(session, "master_data.projects", "CREATE") : false;
  const canManage = session ? hasGrant(session, "master_data.projects", "UPDATE") : false;

  // Draft filter state (edited freely) vs applied (drives the query) — Apply commits.
  const [draftStatus, setDraftStatus] = useState<ProjectStatus | "">("");
  const [draftCustomer, setDraftCustomer] = useState("");
  const [draftPm, setDraftPm] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [applied, setApplied] = useState<{
    status: ProjectStatus | "";
    customerId: string;
    pmId: string;
    q: string;
  }>({ status: "", customerId: "", pmId: "", q: "" });
  const [page, setPage] = useState(1);

  const query = useProjectsList({
    status: applied.status || undefined,
    q: applied.q || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const customersQuery = usePartiesList({ isCustomer: true, pageSize: 200 });
  const usersQuery = useUsers();

  const customers = useMemo(() => {
    const c = customersQuery.data?.data;
    return Array.isArray(c) ? c : [];
  }, [customersQuery.data]);
  const users = useMemo(() => {
    const u = usersQuery.data;
    return Array.isArray(u) ? u : [];
  }, [usersQuery.data]);

  const customerLabel = useMemo(() => {
    const map = new Map(customers.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "—");
  }, [customers]);
  const pmLabel = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "—");
  }, [users]);

  // Client-side customer/PM filter (the list API filters by status/q only, so this
  // narrows the CURRENT page). Keeps the design's three dropdowns functional without a
  // new endpoint; a server-side customer/PM filter is a follow-up if cross-page filtering
  // is needed.
  const rows = useMemo(() => {
    const serverRows = query.data?.data ?? [];
    return serverRows.filter(
      (p) =>
        (!applied.customerId || p.customerId === applied.customerId) &&
        (!applied.pmId || p.projectManagerId === applied.pmId),
    );
  }, [query.data, applied.customerId, applied.pmId]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));
  const hasFilters =
    applied.q !== "" || applied.status !== "" || applied.customerId !== "" || applied.pmId !== "";

  function applyFilters() {
    setPage(1);
    setApplied({ status: draftStatus, customerId: draftCustomer, pmId: draftPm, q: draftQ.trim() });
  }
  function clearFilters() {
    setDraftStatus("");
    setDraftCustomer("");
    setDraftPm("");
    setDraftQ("");
    setPage(1);
    setApplied({ status: "", customerId: "", pmId: "", q: "" });
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* breadcrumb + title + CTA */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: "Master Data" }, { label: "Projects" }]} />
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Projects</h1>
        </div>
        {canCreate && (
          <Button size="md" asChild className="flex-none">
            <Link href="/master-data/projects/new" data-testid="new-project">
              <Plus className="h-4 w-4" aria-hidden />
              New project
            </Link>
          </Button>
        )}
      </div>

      {/* FILTER BAR (design: white card · Status · Customer · PM · Search + Apply/Clear) */}
      <Card className="mt-4 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex w-[150px] flex-none flex-col gap-1.5">
            <Label htmlFor="pj-status">Status</Label>
            <Select
              id="pj-status"
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value as ProjectStatus | "")}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex w-[178px] flex-none flex-col gap-1.5">
            <Label htmlFor="pj-customer">Customer</Label>
            <Select id="pj-customer" value={draftCustomer} onChange={(e) => setDraftCustomer(e.target.value)}>
              <option value="">All customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex w-[160px] flex-none flex-col gap-1.5">
            <Label htmlFor="pj-pm">Project manager</Label>
            <Select id="pj-pm" value={draftPm} onChange={(e) => setDraftPm(e.target.value)}>
              <option value="">All PMs</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
            <Label htmlFor="pj-search">Search</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                aria-hidden
              />
              <Input
                id="pj-search"
                type="search"
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                placeholder="Search by project code or name"
                aria-label="Search projects"
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex items-end gap-2">
            <Button type="submit" size="md" data-testid="projects-apply">
              Apply
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={clearFilters} data-testid="projects-clear">
              Clear filters
            </Button>
          </div>
        </form>
      </Card>

      {/* TABLE CARD + state matrix */}
      <Card className="mt-4 overflow-hidden p-0">
        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="projects-loading">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load projects.">
              <div className="flex flex-col items-start gap-2">
                <span>The server returned an error. Check your connection and try again.</span>
                <Button size="sm" onClick={() => query.refetch()} data-testid="projects-retry">
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
                title="No projects match these filters."
                description="Try a different status, customer, PM, or search term."
                action={
                  <Button size="md" variant="outline" onClick={clearFilters} data-testid="projects-clear-empty">
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="p-8">
              <EmptyState
                icon={FolderKanban}
                title="No projects yet."
                description="Create your first project to start posting vouchers against it."
                action={
                  canCreate ? (
                    <Button size="md" asChild>
                      <Link href="/master-data/projects/new" data-testid="empty-new-project">
                        <Plus className="h-4 w-4" aria-hidden />
                        New project
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )
        ) : (
          <>
            <ProjectsTable
              projects={rows}
              customerLabel={customerLabel}
              pmLabel={pmLabel}
              canManage={canManage}
            />
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[12.5px] text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {total === 0 ? 0 : 1}–{total}
                </span>{" "}
                of <span className="font-semibold text-foreground">{total}</span> project
                {total === 1 ? "" : "s"}
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
                  <span className="px-1 text-[12.5px] tabular-nums text-muted-foreground">
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
    </div>
  );
}
