"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { useProject } from "../hooks/useProjects";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { StatusActionButton } from "./StatusActionButton";
import { ProjectOverviewForm } from "./ProjectOverviewForm";
import { BudgetsTab } from "./BudgetsTab";
import { GodownsTab } from "./GodownsTab";

const LIST_PATH = "/master-data/projects";
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "budgets", label: "Budgets" },
  { key: "godowns", label: "Godowns" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** Project tabbed detail (FR-MAS-005/006/007/014). `id="new"` → create (Overview only). */
export function ProjectDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const session = useSession();
  // Permission-driven (FE-21): UPDATE grant on projects admits managing; Admin always has
  // it. `isAdmin` kept for admin-only affordances the PM shouldn't see. Backend re-checks.
  const isAdmin = session?.role === "ADMIN";
  const canManage = session ? hasGrant(session, "master_data.projects", "UPDATE") : false;
  const isNew = id === "new";
  const [tab, setTab] = useState<TabKey>("overview");

  const query = useProject(id, !isNew);
  const project = query.data;
  const closed = project?.status === "CLOSED";

  const backLink = (
    <Link
      href={LIST_PATH}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Projects
    </Link>
  );

  if (!isNew && query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        {backLink}
        <Skeleton className="mt-3 h-7 w-56" />
        <Card className="mt-4 p-6">
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    );
  }

  if (!isNew && (query.isError || !project)) {
    return (
      <div className="mx-auto max-w-3xl">
        {backLink}
        <div className="mt-4">
          <Alert tone="destructive" title="Couldn't load this project.">
            <Button size="sm" onClick={() => query.refetch()} data-testid="project-retry">
              Retry
            </Button>
          </Alert>
        </div>
      </div>
    );
  }

  function onTabKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next =
        e.key === "ArrowRight" ? (i + 1) % TABS.length : (i - 1 + TABS.length) % TABS.length;
      setTab(TABS[next]!.key);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-1.5 text-xs text-muted-foreground">
        <Link href={LIST_PATH} className="hover:text-foreground">
          Master Data <span className="text-border-strong">/</span> Projects
        </Link>{" "}
        <span className="text-border-strong">/</span>{" "}
        <span className="font-medium text-foreground">
          {isNew ? "New project" : `${project?.projectCode} — ${project?.name}`}
        </span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">
            {isNew ? "New project" : project?.name}
          </h1>
          {project && <ProjectStatusBadge status={project.status} />}
        </div>
        {canManage && project && (
          <StatusActionButton
            project={project}
            isAdmin={!!isAdmin}
            onDone={(m) => toast(m, "success")}
            onError={(m) => toast(m, "error")}
            onReload={() => query.refetch()}
          />
        )}
      </div>

      {/* Tabs (edit mode only) */}
      {!isNew && (
        <div
          role="tablist"
          aria-label="Project sections"
          className="mt-4 flex gap-1 border-b border-border"
        >
          {TABS.map((t, i) => (
            <button
              key={t.key}
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`panel-${t.key}`}
              tabIndex={tab === t.key ? 0 : -1}
              onClick={() => setTab(t.key)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              data-testid={`tab-${t.key}`}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        {(isNew || tab === "overview") && (
          <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
            <ProjectOverviewForm
              mode={project ? { kind: "edit", project } : { kind: "create" }}
              readOnly={!canManage}
              onCreated={(newId) => router.replace(`${LIST_PATH}/${newId}`)}
              onUpdated={() => {
                toast("Project updated.", "success");
                query.refetch();
              }}
              onCancel={() => router.push(LIST_PATH)}
              onReload={() => query.refetch()}
              onError={(m) => toast(m, "error")}
            />
          </div>
        )}
        {!isNew && tab === "budgets" && project && (
          <div role="tabpanel" id="panel-budgets" aria-labelledby="tab-budgets">
            <BudgetsTab projectId={project.id} canManage={canManage} closed={!!closed} />
          </div>
        )}
        {!isNew && tab === "godowns" && project && (
          <div role="tabpanel" id="panel-godowns" aria-labelledby="tab-godowns">
            <GodownsTab projectId={project.id} canManage={canManage} closed={!!closed} />
          </div>
        )}
      </div>
    </div>
  );
}
