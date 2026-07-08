"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { Breadcrumb as UiBreadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { asApiError } from "@/lib/api/errors";
import { useUserDetail } from "../hooks/use-users";
import {
  useAssignedProjects,
  useProjectOptions,
  useReplaceAssignedProjects,
} from "../hooks/use-user-projects";
import {
  dedupeProjectIds,
  isEmptySelection,
  mapProjectAssignmentError,
  SUCCESS_MESSAGE,
} from "../schemas/project-assignment";
import { UserScopeHeader } from "./UserScopeHeader";
import { AllProjectsBanner } from "./AllProjectsBanner";
import { AssignedProjectsList, type AssignedRow } from "./AssignedProjectsList";
import { AddProjectsPicker } from "./AddProjectsPicker";
import { RemoveLastDialog } from "./RemoveLastDialog";
import { ProjectAssignmentSaveBar } from "./ProjectAssignmentSaveBar";
import { AssignmentForbiddenView } from "./AssignmentForbiddenView";

/**
 * Project assignment screen (spec — full screen; FR-AUD-014/015/020). Admin-
 * only. Local add/remove edits accumulate in `pending`; Save commits ONE
 * full-set-replace `PUT /api/users/:id/projects` (spec §9) — never a per-row
 * `DELETE`, never an optimistic-lock `version` (SRS §16).
 */
export function ProjectAssignmentScreen({ userId }: { userId: string }) {
  const session = useSession();
  // Permission-driven (FE-21): user-management (`audit.users:READ`) admits — Admin
  // always has it, and a custom role granted it also gets in. Falls back to Admin-only
  // without a permission projection. Backend re-checks every call.
  const canManage = session ? hasGrant(session, "audit.users", "READ") : false;
  const { toast } = useToast();

  const userQuery = useUserDetail(canManage ? userId : null);
  const assignedQuery = useAssignedProjects(userId, canManage);
  const optionsQuery = useProjectOptions(canManage);
  const saveMutation = useReplaceAssignedProjects(userId);

  const [pending, setPending] = useState<string[]>([]);
  const [base, setBase] = useState<string[]>([]);
  const [selectionError, setSelectionError] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const assignment = assignedQuery.data;
  const isUnscopedByAssignment = assignment?.scope === "ALL";

  // Seed local pending/base state whenever the assigned set (re)loads.
  useEffect(() => {
    if (assignment?.scope === "ASSIGNED") {
      const ids = assignment.projects.map((p) => p.projectId);
      setPending(ids);
      setBase(ids);
      setSelectionError(false);
    }
  }, [assignment]);

  if (!canManage) {
    return <AssignmentForbiddenView />;
  }

  const projectOptions = optionsQuery.data ?? [];
  const nameById = new Map(projectOptions.map((p) => [p.id, p.name]));
  const namedById =
    assignment?.scope === "ASSIGNED"
      ? new Map(assignment.projects.map((p) => [p.projectId, p.projectName]))
      : new Map<string, string | null>();

  const rows: AssignedRow[] = pending.map((id) => ({
    projectId: id,
    name: namedById.get(id) ?? nameById.get(id) ?? null,
  }));

  const dirty = JSON.stringify([...pending].sort()) !== JSON.stringify([...base].sort());
  const userName = userQuery.data?.name ?? "This user";

  function focusPicker() {
    pickerRef.current?.focus();
  }

  function toggleProject(id: string) {
    if (saveMutation.isPending) return;
    setSelectionError(false);
    setPending((cur) => (cur.includes(id) ? cur : dedupeProjectIds([...cur, id])));
  }

  function requestRemove(id: string) {
    if (saveMutation.isPending) return;
    if (pending.length === 1 && pending[0] === id) {
      setConfirmRemoveId(id);
      return;
    }
    setPending((cur) => cur.filter((x) => x !== id));
  }

  function confirmRemoveLast() {
    if (!confirmRemoveId) return;
    setPending((cur) => cur.filter((x) => x !== confirmRemoveId));
    setConfirmRemoveId(null);
  }

  function cancel() {
    if (saveMutation.isPending) return;
    setPending(base);
    setSelectionError(false);
  }

  function save() {
    if (saveMutation.isPending) return;
    const ids = dedupeProjectIds(pending);
    if (isEmptySelection(ids)) {
      setSelectionError(true);
      return;
    }
    setSelectionError(false);
    saveMutation.mutate(
      { projectIds: ids },
      {
        onSuccess: (result) => {
          const nextIds = result.map((p) => p.projectId);
          setBase(nextIds);
          setPending(nextIds);
          toast(SUCCESS_MESSAGE, "success");
        },
        onError: (err) => {
          const mapped = mapProjectAssignmentError(asApiError(err));
          if (mapped.kind === "notFound") {
            // The rejected project id no longer exists in this company — drop it
            // from the selection (spec §6/§13) so a retry can succeed.
            const badId = extractProjectIdFromError(asApiError(err));
            if (badId) {
              setPending((cur) => cur.filter((x) => x !== badId));
            }
          }
          if (mapped.kind === "validation") {
            setSelectionError(true);
          }
          toast(mapped.message, "error");
        },
      },
    );
  }

  const loadFailed = assignedQuery.isError;
  const loadingAssignment = assignedQuery.isLoading;

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col" data-testid="project-assignment-screen">
      <Breadcrumb userName={userQuery.data?.name ?? "…"} />

      <h1 className="mt-1.5 text-[22px] font-bold tracking-[-0.02em] text-foreground">
        Assigned projects
      </h1>

      {loadingAssignment && (
        <div className="mt-3.5" data-testid="screen-loading">
          <Skeleton className="h-[78px] w-full" />
          <Skeleton className="mt-3.5 h-[400px] w-full" />
        </div>
      )}

      {!loadingAssignment && loadFailed && (
        <div className="mt-3.5" data-testid="screen-load-error">
          <AssignedProjectsList
            status="error"
            rows={[]}
            disabled
            onRemove={() => {}}
            onFocusPicker={() => {}}
            onRetry={() => assignedQuery.refetch()}
            projectPool={projectOptions}
          />
        </div>
      )}

      {!loadingAssignment && !loadFailed && isUnscopedByAssignment && (
        <>
          <UserScopeHeader
            name={userQuery.data?.name ?? "…"}
            role={userQuery.data?.role ?? ""}
            isUnscoped
          />
          <AllProjectsBanner />
        </>
      )}

      {!loadingAssignment && !loadFailed && assignment?.scope === "ASSIGNED" && (
        <>
          <UserScopeHeader
            name={userQuery.data?.name ?? "…"}
            role={userQuery.data?.role ?? ""}
            isUnscoped={false}
            selectionAnnounce={`${pending.length} ${pending.length === 1 ? "project" : "projects"} assigned`}
          />

          {/* Desktop >=1024: two-pane. Tablet >=768: stacked. Mobile <768: single stacked scrollable list. */}
          <div className="mt-3.5 grid flex-1 grid-cols-1 items-start gap-4 pb-5 lg:min-h-0 lg:grid-cols-[minmax(0,1.32fr)_minmax(0,1fr)]">
            <AssignedProjectsList
              status="ready"
              rows={rows}
              disabled={saveMutation.isPending}
              onRemove={requestRemove}
              onFocusPicker={focusPicker}
              onRetry={() => assignedQuery.refetch()}
              projectPool={projectOptions}
            />
            <AddProjectsPicker
              ref={pickerRef}
              options={projectOptions}
              selectedIds={pending}
              disabled={saveMutation.isPending}
              onToggle={toggleProject}
            />
          </div>

          <ProjectAssignmentSaveBar
            dirty={dirty}
            saving={saveMutation.isPending}
            selectionError={selectionError}
            onSave={save}
            onCancel={cancel}
          />
        </>
      )}

      <RemoveLastDialog
        open={confirmRemoveId !== null}
        userName={userName}
        onConfirm={confirmRemoveLast}
        onCancel={() => setConfirmRemoveId(null)}
      />
    </div>
  );
}

function Breadcrumb({ userName }: { userName: string }) {
  return (
    <UiBreadcrumb
      items={[
        { label: "Admin", href: "/audit/users" },
        { label: "Users", href: "/audit/users" },
        { label: userName },
        { label: "Projects" },
      ]}
    />
  );
}

/** Best-effort extraction of the offending project id from a NOT_FOUND error's details (spec §6/§13). */
function extractProjectIdFromError(err: {
  details?: Record<string, unknown> | null;
}): string | null {
  const details = err.details;
  if (!details) return null;
  const id = details["projectId"];
  return typeof id === "string" ? id : null;
}
