"use client";

import { useEffect, useMemo, useState } from "react";
import { Tag, Plus, Search } from "lucide-react";
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
import { useProjectsList } from "../hooks/useProjects";
import { usePurposes } from "../hooks/usePurposes";
import { type Project, type Purpose } from "../types";
import { ProjectSelector } from "./ProjectSelector";
import { PurposesTable } from "./PurposesTable";
import { PurposeFormModal } from "./PurposeFormModal";
import { PurposeStatusDialog } from "./PurposeStatusDialog";
import { PurposeCombobox } from "./PurposeCombobox";

type Modal = { kind: "create" } | { kind: "edit"; purpose: Purpose } | null;

/** Purposes screen (FR-MAS-011/012/013/029/033) — project-scoped list + inline-create combobox. */
export function PurposesScreen() {
  const session = useSession();
  // Permission-driven (FE-21): UPDATE admits managing, CREATE admits creating; Admin has
  // both. A custom role granted these in Roles & permissions gets in too. Backend re-checks.
  const canManage = session ? hasGrant(session, "master_data.purposes", "UPDATE") : false;
  const canCreate = session ? hasGrant(session, "master_data.purposes", "CREATE") : false;
  const { toast } = useToast();

  const projectsQuery = useProjectsList({ pageSize: 100 });
  const projects: Project[] = useMemo(() => projectsQuery.data?.data ?? [], [projectsQuery.data]);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0]!.id);
  }, [projects, projectId]);

  const [activeOnly, setActiveOnly] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [statusTarget, setStatusTarget] = useState<{
    purpose: Purpose;
    mode: "deactivate" | "reactivate";
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const query = usePurposes(projectId, {
    isActive: activeOnly ? true : undefined,
    q: debouncedQ || undefined,
  });
  const rows = query.data?.data ?? [];
  const hasFilters = debouncedQ !== "";
  const selectedProject = projects.find((p) => p.id === projectId) ?? null;
  const closedProject = selectedProject?.status === "CLOSED";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: "Master Data" }, { label: "Purposes" }]} />
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Purposes</h1>
        </div>
        {canManage && projectId && (
          <Button
            size="md"
            onClick={() => setModal({ kind: "create" })}
            className="flex-none"
            data-testid="new-purpose"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New purpose
          </Button>
        )}
      </div>

      <div className="mt-4">
        <ProjectSelector
          projects={projects}
          value={projectId}
          onChange={setProjectId}
          loading={projectsQuery.isLoading}
        />
      </div>

      {!projectId ? (
        <Card className="mt-4 p-8">
          <EmptyState
            icon={Tag}
            title="Select a project"
            description="Purposes are managed per project. Choose one above to begin."
          />
        </Card>
      ) : (
        <>
          {/* Inline-create combobox — the reusable control voucher forms consume */}
          {canCreate && (
            <Card className="mt-4 p-4">
              <Label className="mb-1.5 block text-[10.5px]">
                Quick add / pick (used inline in voucher forms)
              </Label>
              <PurposeCombobox
                projectId={projectId}
                value={null}
                canCreate={canCreate}
                closedProject={closedProject}
                onChange={(p) => {
                  toast(`‘${p.name}’ selected.`, "success");
                  query.refetch();
                }}
              />
            </Card>
          )}

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
                placeholder="Search purposes…"
                aria-label="Search purposes"
                className="pl-9"
              />
            </div>
          </div>

          <Card className="mt-3.5 overflow-hidden p-3 sm:p-4">
            {query.isLoading ? (
              <div className="flex flex-col gap-2" data-testid="purposes-loading">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : query.isError ? (
              <Alert tone="destructive" title="Couldn't load purposes.">
                <div className="flex flex-col items-start gap-2">
                  <span>The server returned an error. Check your connection and try again.</span>
                  <Button size="sm" onClick={() => query.refetch()} data-testid="purposes-retry">
                    Retry
                  </Button>
                </div>
              </Alert>
            ) : rows.length === 0 ? (
              hasFilters ? (
                <EmptyState
                  icon={Search}
                  title="No purposes match these filters."
                  action={
                    <Button
                      size="md"
                      variant="outline"
                      onClick={() => setQ("")}
                      data-testid="purposes-clear"
                    >
                      Clear
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Tag}
                  title="No purposes for this project yet."
                  description="Add purposes to tag postings for this project."
                  action={
                    canManage ? (
                      <Button
                        size="md"
                        onClick={() => setModal({ kind: "create" })}
                        data-testid="empty-new-purpose"
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                        New purpose
                      </Button>
                    ) : undefined
                  }
                />
              )
            ) : (
              <PurposesTable
                purposes={rows}
                canManage={canManage}
                onRename={(p) => setModal({ kind: "edit", purpose: p })}
                onDeactivate={(p) => setStatusTarget({ purpose: p, mode: "deactivate" })}
                onReactivate={(p) => setStatusTarget({ purpose: p, mode: "reactivate" })}
              />
            )}
          </Card>
        </>
      )}

      {modal && projectId && (
        <PurposeFormModal
          mode={
            modal.kind === "edit" ? { kind: "edit", purpose: modal.purpose } : { kind: "create" }
          }
          projectId={projectId}
          onClose={() => setModal(null)}
          onSuccess={(m) => toast(m, "success")}
          onConflict={() => {
            setModal(null);
            toast("This purpose was changed by someone else. Reload and try again.", "error");
            query.refetch();
          }}
          onError={(m) => toast(m, "error")}
        />
      )}

      {projectId && (
        <PurposeStatusDialog
          projectId={projectId}
          purpose={statusTarget?.purpose ?? null}
          mode={statusTarget?.mode ?? "deactivate"}
          onClose={() => setStatusTarget(null)}
          onReload={() => query.refetch()}
        />
      )}
    </div>
  );
}
