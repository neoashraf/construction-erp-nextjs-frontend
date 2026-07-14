"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { ApiError } from "@/lib/api/errors";
import { formatMoney } from "@/lib/money";
import { canReleaseRetention } from "../access";
import { useProjectOptions, useFinancialYearOptions } from "../hooks/useIpcOptions";
import { useIpcRegister } from "../hooks/useIpcRegister";
import { useReleaseRetention } from "../hooks/useReleaseRetention";
import { mapReleaseError } from "../schemas/retention-release.schema";
import { RegisterFilterBar } from "./RegisterFilterBar";
import { IpcRegisterTable } from "./IpcRegisterTable";
import { RetentionPanel } from "./RetentionPanel";
import { ReleaseRetentionDialog } from "./ReleaseRetentionDialog";
import { type RetentionBreakdownItem } from "./RetentionBreakdownRow";
import { type IpcRegisterRow } from "../types";

/**
 * The `sales/ipc-register` screen container (fe-ipc-register-retention). Composes the
 * project-picker filter bar, the register table + pinned totals, the retention panel + per-
 * IPC breakdown + Release dialog. Selecting a project or FY re-fetches both together (spec
 * §9 "shared project scope"); the release action posts server-confirmed only, then refreshes
 * both (spec §6 success). Deep-link deep-linking supplies `?projectId=…` (also `?fy=…`).
 * PM: Release button is HIDDEN (not disabled) per spec §11; the server re-checks regardless.
 * Guarded upstream on `sales.ipc_register:READ` (the page's `requireModuleAccess("sales")`).
 */
export function IpcRegisterScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const user = useAuthenticatedUser();
  const online = useOnline();
  const { toast } = useToast();
  const canRelease = canReleaseRetention(user);

  const initialProjectId = search.get("projectId") ?? "";
  const initialFy = search.get("fy") ?? "";
  const [projectId, setProjectId] = useState(initialProjectId);
  const [financialYearId, setFinancialYearId] = useState(initialFy);

  const projectsQ = useProjectOptions();
  const fyQ = useFinancialYearOptions();
  const projects = useMemo(() => projectsQ.data ?? [], [projectsQ.data]);
  const fys = useMemo(() => fyQ.data ?? [], [fyQ.data]);
  const project = useMemo(() => projects.find((p) => p.id === projectId) ?? null, [projects, projectId]);

  const registerQ = useIpcRegister(projectId, financialYearId || undefined, !!projectId);
  const register = registerQ.data;

  const [dialogItem, setDialogItem] = useState<RetentionBreakdownItem | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [amountFieldError, setAmountFieldError] = useState<string | null>(null);

  const release = useReleaseRetention();

  function changeProject(id: string) {
    setProjectId(id);
    setFinancialYearId(""); // reset FY on project switch
    const params = new URLSearchParams();
    if (id) params.set("projectId", id);
    router.replace(`/sales/ipc-register${params.toString() ? `?${params}` : ""}`);
  }

  function changeFy(id: string) {
    setFinancialYearId(id);
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    if (id) params.set("fy", id);
    router.replace(`/sales/ipc-register${params.toString() ? `?${params}` : ""}`);
  }

  function openRelease(item: RetentionBreakdownItem) {
    setBanner(null);
    setAmountFieldError(null);
    setDialogItem(item);
  }

  function closeRelease() {
    setDialogItem(null);
    setBanner(null);
    setAmountFieldError(null);
  }

  function rowRoute(r: IpcRegisterRow): string {
    // Register only returns POSTED rows (no draft IPC in the register). Route to the viewer;
    // PM's IPC viewer path is the same read-only shell (spec §9).
    return `/sales/ipcs/${r.ipcId}`;
  }

  function retryRegister() {
    void registerQ.refetch();
  }

  function goNewIpc() {
    if (projectId) router.push(`/sales/ipcs/new?projectId=${projectId}`);
    else router.push("/sales/ipcs/new");
  }

  function submitRelease(input: Parameters<typeof release.mutate>[0]["input"]) {
    if (!dialogItem) return;
    setBanner(null);
    setAmountFieldError(null);
    release.mutate(
      { ipcId: dialogItem.ipcId, input },
      {
        onSuccess: async (res) => {
          const amt = formatMoney(res.releasedAmount, { withSymbol: false, fractionDigits: 2 });
          toast(`Retention released — ৳${amt} moved to currently-due (number ${res.entryNo}).`, "success");
          closeRelease();
          // Force an immediate refetch here — the shared cache invalidation in
          // `useReleaseRetention` sometimes lags the toast; a direct `.refetch()` guarantees
          // the register + retention panel are reconciled by the next paint (spec §6).
          void registerQ.refetch();
        },
        onError: (err) => {
          const api = err as ApiError;
          const mapped = mapReleaseError(api.code, {
            retentionHeldAmount: dialogItem.retentionHeldAmount,
          });
          if (mapped.kind === "field" && mapped.field === "releasedAmount") {
            setAmountFieldError(mapped.message);
          } else {
            setBanner(mapped.message);
          }
        },
      },
    );
  }

  // ── Register status derivation ──
  const registerStatus = deriveStatus(!projectId, registerQ, register?.rows.length ?? 0);
  const retentionStatus = deriveStatus(!projectId, registerQ, register?.rows.filter((r) => Number(r.retentionAmount) > 0).length ?? 0);

  // Permission-denied for a PM opening an unassigned project (spec §6 register error / 403)
  const isForbidden = registerQ.isError && (registerQ.error as ApiError | undefined)?.status === 403;

  return (
    <div className="mx-auto max-w-[1440px]" data-testid="ipc-register-screen">
      <Breadcrumb
        items={[
          { label: "Sales / IPC Billing" },
          { label: "Project IPC register", href: "/sales/ipc-register" },
          ...(project ? [{ label: project.name }] : []),
        ]}
      />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="ipc-register-title">
          Project IPC register
        </h1>
        <span className="inline-flex h-[24px] items-center gap-1.5 rounded-pill bg-info-soft px-2.5 text-[11px] font-semibold text-info-ink">
          <Eye className="h-3 w-3" aria-hidden />
          Read / derived view
        </span>
        {register && (
          <span className="inline-flex h-[24px] items-center gap-1.5 rounded-pill bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground">
            {register.rows.length} IPC{register.rows.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <RegisterFilterBar
        projectId={projectId}
        financialYearId={financialYearId}
        projects={projects}
        financialYears={fys}
        onChangeProject={changeProject}
        onChangeFinancialYear={changeFy}
      />

      {!projectId ? (
        <div className="mt-2">
          <EmptyState
            title="Select a project"
            description="Choose a project above to load its IPC register and retention position."
          />
        </div>
      ) : isForbidden ? (
        <div className="mt-2">
          <EmptyState
            title="You don't have access to this project's register."
            description="Ask an administrator to assign this project to your account."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <IpcRegisterTable
            register={register}
            status={registerStatus}
            offline={!online}
            onRowRoute={rowRoute}
            isDimmed={registerQ.isFetching && !registerQ.isLoading}
            onRetry={retryRegister}
            canCreate={canRelease}
            onNewIpc={goNewIpc}
          />
          <RetentionPanel
            register={register}
            status={retentionStatus}
            canRelease={canRelease}
            releasingIpcId={release.isPending ? dialogItem?.ipcId ?? null : null}
            onRetry={retryRegister}
            onOpenRelease={openRelease}
            isDimmed={registerQ.isFetching && !registerQ.isLoading}
          />
        </div>
      )}

      <ReleaseRetentionDialog
        open={!!dialogItem}
        item={dialogItem}
        busy={release.isPending}
        bannerMessage={banner}
        fieldErrorFromServer={amountFieldError}
        onConfirm={submitRelease}
        onCancel={closeRelease}
      />
    </div>
  );
}

function deriveStatus(
  noProject: boolean,
  q: { isLoading: boolean; isError: boolean; data: unknown },
  visibleRowCount: number,
): "loading" | "error" | "empty" | "loaded" {
  if (noProject) return "loaded";
  if (q.isLoading) return "loading";
  if (q.isError) return "error";
  if (visibleRowCount === 0) return "empty";
  return "loaded";
}
