"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FolderKanban, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { useSession } from "@/providers/session-provider";
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

/** Projects list screen (FR-MAS-005/006). Filter/search + table. Admin creates. */
export function ProjectsScreen() {
  const session = useSession();
  const canCreate = session?.role === "ADMIN";

  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [status, debouncedQ]);

  const query = useProjectsList({
    status: status || undefined,
    q: debouncedQ || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const customersQuery = usePartiesList({ isCustomer: true, pageSize: 200 });
  const usersQuery = useUsers();

  const customerLabel = useMemo(() => {
    const map = new Map((customersQuery.data?.data ?? []).map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "—");
  }, [customersQuery.data]);
  const pmLabel = useMemo(() => {
    const map = new Map((usersQuery.data ?? []).map((u) => [u.id, u.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "—");
  }, [usersQuery.data]);

  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = debouncedQ !== "" || status !== "";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="mb-1.5 text-xs text-muted-foreground">
            Master Data <span className="text-border-strong">/</span>{" "}
            <span className="font-medium text-foreground">Projects</span>
          </nav>
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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="w-40">
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus | "")}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
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
            aria-label="Search projects"
            className="pl-9"
          />
        </div>
      </div>

      <Card className="mt-3.5 overflow-hidden p-3 sm:p-4">
        {query.isLoading ? (
          <div className="flex flex-col gap-2" data-testid="projects-loading">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <Alert tone="destructive" title="Couldn't load projects.">
            <div className="flex flex-col items-start gap-2">
              <span>The server returned an error. Check your connection and try again.</span>
              <Button size="sm" onClick={() => query.refetch()} data-testid="projects-retry">
                Retry
              </Button>
            </div>
          </Alert>
        ) : rows.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={Search}
              title="No projects match these filters."
              action={
                <Button
                  size="md"
                  variant="outline"
                  onClick={() => {
                    setQ("");
                    setStatus("");
                  }}
                  data-testid="projects-clear"
                >
                  Clear
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={FolderKanban}
              title="No projects yet."
              description="Create projects to tag postings, budgets, and stores against."
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
          )
        ) : (
          <>
            <ProjectsTable projects={rows} customerLabel={customerLabel} pmLabel={pmLabel} />
            <div className="mt-3 flex items-center justify-between border-t border-border px-1 pt-3">
              <span className="text-[12.5px] text-muted-foreground">
                {total} project{total === 1 ? "" : "s"}
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
    </div>
  );
}
