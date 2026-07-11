"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { formatDate } from "@/lib/format";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { type Project, type ProjectStatus } from "../types";
import { useProject } from "../hooks/useProjects";
import { usePartiesList } from "../hooks/useParties";
import { useUsers } from "../hooks/useUsers";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { StatusActionButton } from "./StatusActionButton";
import { ProjectFormDrawer } from "./ProjectFormDrawer";
import { BudgetsTab } from "./BudgetsTab";
import { GodownsTab } from "./GodownsTab";

const LIST_PATH = "/master-data/projects";
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "budgets", label: "Budgets" },
  { key: "godowns", label: "Godowns" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** Fixed lifecycle order (FR-MAS-006). */
const LIFECYCLE: { status: ProjectStatus; label: string }[] = [
  { status: "PLANNED", label: "Planned" },
  { status: "ACTIVE", label: "Active" },
  { status: "ON_HOLD", label: "On hold" },
  { status: "CLOSED", label: "Closed" },
];

/** The current lifecycle dot takes the status's own colour (Projects.dc.html). */
const STATUS_DOT: Record<ProjectStatus, string> = {
  PLANNED: "bg-info",
  ACTIVE: "bg-success",
  ON_HOLD: "bg-warning",
  CLOSED: "bg-faint",
};

/** Project tabbed detail (FR-MAS-005/006/007/014; Projects.dc.html detail view). */
export function ProjectDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const session = useSession();
  const isAdmin = session?.role === "ADMIN";
  const canManage = session ? hasGrant(session, "master_data.projects", "UPDATE") : false;
  const isNew = id === "new";
  const [tab, setTab] = useState<TabKey>("overview");
  const [drawerOpen, setDrawerOpen] = useState(isNew);

  const query = useProject(id, !isNew);
  const project = query.data;
  const closed = project?.status === "CLOSED";

  // Name lookups for the identity subline/card (project stores IDs).
  const customersData = usePartiesList({ isCustomer: true, pageSize: 200 }).data?.data;
  const usersData = useUsers().data;
  const customerName = useMemo(() => {
    const m = new Map((customersData ?? []).map((c) => [c.id, c.name]));
    return (pid: string | null) => (pid ? (m.get(pid) ?? "—") : "—");
  }, [customersData]);
  const pmName = useMemo(() => {
    const m = new Map((usersData ?? []).map((u) => [u.id, u.name]));
    return (uid: string | null) => (uid ? (m.get(uid) ?? "—") : "—");
  }, [usersData]);

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
      <div className="mx-auto max-w-6xl">
        {backLink}
        <Skeleton className="mt-3 h-7 w-72" />
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="p-6">
            <Skeleton className="h-40 w-full" />
          </Card>
          <Card className="p-6">
            <Skeleton className="h-40 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  if (!isNew && (query.isError || !project)) {
    return (
      <div className="mx-auto max-w-6xl">
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

  // ── NEW: the create flow is the drawer over a minimal frame ──
  if (isNew) {
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb
          items={[{ label: "Master Data" }, { label: "Projects", href: LIST_PATH }, { label: "New project" }]}
        />
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">New project</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Fill in the project details to start posting vouchers against it.
        </p>
        {drawerOpen && (
          <ProjectFormDrawer
            mode={{ kind: "create" }}
            onClose={() => router.push(LIST_PATH)}
            onCreated={(newId) => router.replace(`${LIST_PATH}/${newId}`)}
            onUpdated={() => {}}
            onReload={() => {}}
          />
        )}
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb
        items={[
          { label: "Master Data" },
          { label: "Projects", href: LIST_PATH },
          { label: `${project.projectCode} — ${project.name}` },
        ]}
      />

      {/* TITLE ROW: code · name + status pill + subline + actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-[11px]">
            <h1 className="text-[22px] font-bold tracking-[-0.02em] text-foreground">
              <span className="font-mono text-[18px] font-semibold text-muted-foreground">
                {project.projectCode}
              </span>{" "}
              · {project.name}
            </h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <div className="mt-[7px] flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <span className={cn(!project.location && "text-faint")}>{project.location || "—"}</span>
            <span className="text-border-strong">·</span>
            <span>
              Customer{" "}
              <span className="font-medium text-foreground">{customerName(project.customerId)}</span>
            </span>
            <span className="text-border-strong">·</span>
            <span>
              PM <span className="font-medium text-foreground">{pmName(project.projectManagerId)}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-none items-center gap-[9px]">
          {canManage && tab === "overview" && !closed && (
            <Button variant="outline" size="md" onClick={() => setDrawerOpen(true)} data-testid="project-edit">
              Edit
            </Button>
          )}
          {canManage && (
            <StatusActionButton
              project={project}
              isAdmin={!!isAdmin}
              onDone={(m) => toast(m, "success")}
              onError={(m) => toast(m, "error")}
              onReload={() => query.refetch()}
            />
          )}
        </div>
      </div>

      {/* TABS */}
      <div role="tablist" aria-label="Project sections" className="mt-[18px] flex gap-1 border-b border-border-strong">
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
              "relative h-10 px-4 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === t.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span
              className={cn(
                "absolute inset-x-2 -bottom-px h-[2.5px] rounded-t-[3px]",
                tab === t.key ? "bg-accent" : "bg-transparent",
              )}
              aria-hidden
            />
          </button>
        ))}
      </div>

      <div className="mt-[18px]">
        {tab === "overview" && (
          <div
            role="tabpanel"
            id="panel-overview"
            aria-labelledby="tab-overview"
            className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
          >
            <IdentityCard project={project} customerName={customerName} pmName={pmName} />
            <LifecycleCard status={project.status} />
          </div>
        )}
        {tab === "budgets" && (
          <div role="tabpanel" id="panel-budgets" aria-labelledby="tab-budgets">
            <BudgetsTab projectId={project.id} canManage={canManage} closed={!!closed} />
          </div>
        )}
        {tab === "godowns" && (
          <div role="tabpanel" id="panel-godowns" aria-labelledby="tab-godowns">
            <GodownsTab projectId={project.id} canManage={canManage} closed={!!closed} />
          </div>
        )}
      </div>

      {drawerOpen && (
        <ProjectFormDrawer
          mode={{ kind: "edit", project }}
          onClose={() => setDrawerOpen(false)}
          onCreated={() => {}}
          onUpdated={() => {
            toast("Project updated.", "success");
            setDrawerOpen(false);
            query.refetch();
          }}
          onReload={() => query.refetch()}
        />
      )}
    </div>
  );
}

/** Read-only field cell in the Identity card. */
function Field({
  label,
  value,
  span,
  mono,
  muted,
}: {
  label: string;
  value: string;
  span?: boolean;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={cn("min-w-0", span && "col-span-2")}>
      <div className="mb-[5px] text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">
        {label}
      </div>
      <div
        className={cn(
          "break-words text-[14px]",
          mono && "font-mono",
          muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function IdentityCard({
  project,
  customerName,
  pmName,
}: {
  project: Project;
  customerName: (id: string | null) => string;
  pmName: (id: string | null) => string;
}) {
  const statusLabel = LIFECYCLE.find((l) => l.status === project.status)?.label ?? project.status;
  return (
    <div className="rounded-[11px] border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-[18px] py-[15px] text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground">
        Identity
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-[18px] p-[18px]">
        <Field label="Project code" value={project.projectCode} mono muted />
        <Field label="Status" value={statusLabel} />
        <Field label="Name" value={project.name} span />
        <Field label="Location" value={project.location || "—"} span muted={!project.location} />
        <Field label="Customer" value={customerName(project.customerId)} />
        <Field label="Project manager" value={pmName(project.projectManagerId)} />
        <Field label="Start date" value={formatDate(project.startDate)} mono />
        <Field label="Expected end date" value={formatDate(project.expectedEndDate)} mono />
        {project.status === "CLOSED" && project.actualEndDate && (
          <Field label="Actual end date" value={formatDate(project.actualEndDate)} mono span />
        )}
      </div>
    </div>
  );
}

function LifecycleCard({ status }: { status: ProjectStatus }) {
  const note =
    status === "CLOSED"
      ? "Closed projects are read-only for new transactions. Reopen from the header to resume posting."
      : "PLANNED → ACTIVE → ON_HOLD ↔ ACTIVE → CLOSED. Closing blocks new transactions; existing records are kept.";
  return (
    <div className="rounded-[11px] border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-[18px] py-[15px] text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground">
        Status lifecycle
      </div>
      <div className="p-[18px]">
        <div className="flex flex-col gap-0.5">
          {LIFECYCLE.map((l) => {
            const current = l.status === status;
            return (
              <div key={l.status} className="flex items-center gap-[11px] py-[7px]">
                <span
                  className={cn(
                    "h-[11px] w-[11px] flex-none rounded-full",
                    current ? STATUS_DOT[l.status] : "border-2 border-border-strong bg-surface",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "text-[13px]",
                    current ? "font-bold text-foreground" : "font-medium text-faint",
                  )}
                >
                  {l.label}
                </span>
                {current && (
                  <span className="ml-auto text-[10.5px] font-bold uppercase tracking-[0.4px] text-accent-ink">
                    Current
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-[14px] flex gap-[9px] rounded-[9px] border border-border bg-surface-2 px-[13px] py-[11px]">
          <Info className="mt-px h-[13px] w-[13px] flex-none text-info" aria-hidden />
          <span className="text-[12px] leading-[1.5] text-muted-foreground">{note}</span>
        </div>
      </div>
    </div>
  );
}
