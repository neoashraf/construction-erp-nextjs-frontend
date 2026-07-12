"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Printer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { useOnline } from "@/lib/hooks/use-online";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { asApiError } from "@/lib/api";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canCancelIpc, canPostIpc, canWriteIpc } from "../access";
import { useIpc } from "../hooks/useIpc";
import { useIpcMutations } from "../hooks/useIpcMutations";
import { useCostCentreOptions, useCreatePurpose, useCustomerOptions, useProjectOptions, usePurposeOptions } from "../hooks/useIpcOptions";
import {
  currentlyDue as computeCurrentlyDue,
  defaultAdvanceRecovered,
  defaultOutputVat,
  defaultRetention,
  emptyIpcForm,
  formToWriteInput,
  ipcToForm,
  isEditable,
  mapIpcError,
  rawCurrentlyDue,
  validateIpc,
  type FieldErrors,
  type FigureKey,
  type IpcFormValues,
} from "../schemas/ipc.schema";
import { IpcCaptureFields } from "./IpcCaptureFields";
import { ComputedFiguresPanel } from "./ComputedFiguresPanel";
import { LedgerEffectPreview } from "./LedgerEffectPreview";
import { IpcStatusBadge } from "./IpcStatusBadge";
import { PostDialog } from "./PostDialog";
import { CancelDialog } from "./CancelDialog";
import { RepostDialog } from "./RepostDialog";
import { DiscardDraftDialog } from "./DiscardDraftDialog";
import { type Ipc, type ProjectOption } from "../types";

const FIGURE_KEYS: FigureKey[] = ["outputVatAmount", "aitTdsAmount", "retentionAmount", "advanceRecoveredAmount"];

/** Re-default the untouched figures for a certified/advance change (touched overrides persist). */
function withFigureDefaults(form: IpcFormValues, touched: Set<FigureKey>, remainingAdvance: string): IpcFormValues {
  const c = form.certifiedAmount;
  return {
    ...form,
    outputVatAmount: touched.has("outputVatAmount") ? form.outputVatAmount : defaultOutputVat(c),
    retentionAmount: touched.has("retentionAmount") ? form.retentionAmount : defaultRetention(c),
    advanceRecoveredAmount: touched.has("advanceRecoveredAmount") ? form.advanceRecoveredAmount : defaultAdvanceRecovered(c, remainingAdvance),
  };
}

/**
 * IPC editor / posted read-only form (spec §4/§6; FR-SAL-001…-024). A blank DRAFT for `"new"`,
 * else the loaded IPC — editable only while DRAFT (a posted/cancelled IPC renders fully
 * read-only with the status-appropriate action bar). Live currently-due + balanced ledger-effect
 * preview (never asserts balance — LED is authoritative). Save persists a DRAFT; Post is
 * server-confirmed behind a mandatory confirm dialog (atomic — allocates the gapless number);
 * Cancel / Repost (both `sales:cancel`-gated) reverse / reverse-and-repost a posted IPC.
 */
export function IpcEditor({ ipcId }: { ipcId: string | null }) {
  const router = useRouter();
  const online = useOnline();
  const { toast } = useToast();
  const user = useAuthenticatedUser();
  const canWrite = canWriteIpc(user);
  const canPost = canPostIpc(user);
  const canCancel = canCancelIpc(user);

  const isNew = ipcId === null;
  const detail = useIpc(ipcId);
  const saved: Ipc | undefined = detail.data;

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isPhone = useMediaQuery("(max-width: 767px)");

  const [form, setForm] = useState<IpcFormValues>(emptyIpcForm);
  const touchedRef = useRef<Set<FigureKey>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posting, setPosting] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [figuresOpen, setFiguresOpen] = useState(false);

  const [postOpen, setPostOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [repostOpen, setRepostOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const { create, update, remove, post, cancel, repost } = useIpcMutations();

  // Options.
  const projectsData = useProjectOptions().data;
  const customersData = useCustomerOptions().data;
  const projects = projectsData ?? [];
  const costCentres = useCostCentreOptions().data ?? [];
  const purposesQuery = usePurposeOptions(form.projectId);
  const purposes = purposesQuery.data ?? [];
  const createPurpose = useCreatePurpose();

  const projectMap = useMemo(() => new Map((projectsData ?? []).map((p) => [p.id, p])), [projectsData]);
  const customerMap = useMemo(() => new Map((customersData ?? []).map((c) => [c.id, c.name])), [customersData]);

  const selectedProject: ProjectOption | undefined = projectMap.get(form.projectId);
  const remainingAdvance = selectedProject?.remainingAdvance ?? "0.0000";
  const hasMobilizationAdvance = selectedProject?.hasMobilizationAdvance ?? false;

  const customerName =
    selectedProject?.customerName ||
    (saved ? customerMap.get(saved.customerId) ?? `${saved.customerId.slice(0, 8)} (name unavailable)` : "");

  function remainingFor(projectId: string): string {
    return projectMap.get(projectId)?.remainingAdvance ?? "0.0000";
  }

  // Populate the form once the saved IPC loads (edit / view / correction). Preserve saved
  // figures (mark all touched) so editing certified never silently overwrites an override.
  useEffect(() => {
    if (!saved) return;
    setForm(ipcToForm(saved));
    touchedRef.current = new Set(FIGURE_KEYS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id, saved?.version]);

  const readOnly = !!saved && !isEditable(saved.status) && !correcting;
  const editable = !readOnly && (isNew ? canWrite : correcting ? canCancel : canWrite);

  const dueRaw = rawCurrentlyDue(form);
  const currentlyDue = computeCurrentlyDue(form);
  const negative = form.certifiedAmount.trim() !== "" && dueRaw.isNegative();

  const postReady = editable && validateIpc(form, remainingAdvance).errors === null;

  // ── form mutations ──
  function patch(p: Partial<IpcFormValues>) {
    setBanner(null);
    setForm((prev) => {
      let next = { ...prev, ...p };
      if (p.projectId !== undefined && p.projectId !== prev.projectId) {
        next.purposeId = ""; // project re-scopes purpose (FR-SAL-002)
      }
      if (p.certifiedAmount !== undefined || p.projectId !== undefined) {
        next = withFigureDefaults(next, touchedRef.current, remainingFor(next.projectId));
      }
      return next;
    });
    // clear the touched-field errors as the user edits
    setFieldErrors((prev) => {
      const copy = { ...prev };
      for (const k of Object.keys(p)) delete copy[k as keyof IpcFormValues];
      return copy;
    });
  }

  /** A direct figure edit marks it overridden so a later certified change won't re-default it. */
  function onFigureChange(p: Partial<IpcFormValues>) {
    setBanner(null);
    for (const k of Object.keys(p)) {
      if (FIGURE_KEYS.includes(k as FigureKey)) touchedRef.current.add(k as FigureKey);
    }
    setForm((prev) => ({ ...prev, ...p }));
    setFieldErrors((prev) => {
      const copy = { ...prev };
      for (const k of Object.keys(p)) delete copy[k as keyof IpcFormValues];
      return copy;
    });
  }

  function applyServerError(err: unknown) {
    const e = asApiError(err);
    const mapped = mapIpcError(e.code, { seqNo: form.ipcSeqNo });
    if (mapped.field) setFieldErrors((prev) => ({ ...prev, [mapped.field as keyof IpcFormValues]: mapped.message }));
    setBanner(mapped.message);
  }

  function validate(): IpcFormValues | null {
    const res = validateIpc(form, remainingAdvance);
    if (res.errors === null) {
      setFieldErrors({});
      return res.values;
    }
    setFieldErrors(res.errors);
    if (res.banner) setBanner(res.banner);
    return null;
  }

  /** Persist the current form as a DRAFT; returns {id, version} or null on failure. */
  async function persist(values: IpcFormValues): Promise<{ id: string; version: number } | null> {
    const input = formToWriteInput(values);
    try {
      if (saved?.id) {
        const updated = await update.mutateAsync({ id: saved.id, input: { ...input, version: saved.version } });
        return { id: updated.id, version: updated.version };
      }
      const created = await create.mutateAsync(input);
      return { id: created.id, version: 1 };
    } catch (err) {
      applyServerError(err);
      return null;
    }
  }

  async function onSaveDraft() {
    if (!online) {
      setBanner("You're offline. This IPC wasn't saved.");
      return;
    }
    setBanner(null);
    const values = validate();
    if (!values) return;
    setBusy(true);
    const res = await persist(values);
    setBusy(false);
    if (!res) return;
    toast("IPC saved as draft.", "success");
    if (isNew) router.replace(`/sales/ipcs/${res.id}`);
  }

  function onPostClick() {
    if (!online) {
      setBanner("You're offline. This IPC can't be posted.");
      return;
    }
    setBanner(null);
    if (!validate()) return;
    setPostOpen(true);
  }

  async function onPostConfirm() {
    const values = validate();
    if (!values) {
      setPostOpen(false);
      return;
    }
    setBusy(true);
    setPosting(true);
    const res = await persist(values);
    if (!res) {
      setBusy(false);
      setPosting(false);
      setPostOpen(false);
      return;
    }
    try {
      const result = await post.mutateAsync({ id: res.id, version: res.version });
      setPostOpen(false);
      toast(`IPC posted — number ${result.entryNo}.`, "success");
      if (isNew) router.replace(`/sales/ipcs/${res.id}`);
    } catch (err) {
      setPostOpen(false);
      applyServerError(err);
    } finally {
      setBusy(false);
      setPosting(false);
    }
  }

  async function onCancelConfirm(reason: string) {
    if (!saved) return;
    setBusy(true);
    try {
      const result = await cancel.mutateAsync({ id: saved.id, reason, version: saved.version });
      setCancelOpen(false);
      toast(`IPC cancelled — reversal ${result.reversalEntryNo} (original number retained).`, "success");
    } catch (err) {
      setCancelOpen(false);
      applyServerError(err);
    } finally {
      setBusy(false);
    }
  }

  function onRepostClick() {
    if (!online) {
      setBanner("You're offline. This correction can't be posted.");
      return;
    }
    setBanner(null);
    if (!validate()) return;
    setRepostOpen(true);
  }

  async function onRepostConfirm(reason: string) {
    if (!saved) return;
    const values = validate();
    if (!values) {
      setRepostOpen(false);
      return;
    }
    setBusy(true);
    setPosting(true);
    try {
      const result = await repost.mutateAsync({
        id: saved.id,
        input: { ...formToWriteInput(values), reason, version: saved.version },
      });
      setRepostOpen(false);
      setCorrecting(false);
      const original = saved.linkage?.originalEntryNo ?? saved.entryNo ?? "";
      toast(`IPC corrected — new number ${result.entryNo} (original ${original} retained).`, "success");
    } catch (err) {
      setRepostOpen(false);
      applyServerError(err);
    } finally {
      setBusy(false);
      setPosting(false);
    }
  }

  async function onDiscardConfirm() {
    if (!saved) return;
    setBusy(true);
    try {
      await remove.mutateAsync({ id: saved.id });
      setDiscardOpen(false);
      toast("Draft discarded.", "success");
      router.push("/sales/ipcs");
    } catch (err) {
      setDiscardOpen(false);
      applyServerError(err);
    } finally {
      setBusy(false);
    }
  }

  // ── Render: loading / error / 403 ──
  if (ipcId && detail.isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 mt-1 flex flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <Card className="flex flex-col gap-4 p-5" data-testid="ipc-loading">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </Card>
          <Card className="flex flex-col gap-4 p-5">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            <Skeleton className="h-16 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  if (ipcId && detail.isError) {
    const e = asApiError(detail.error);
    const msg = e.code === "FORBIDDEN" ? "You don't have access to this IPC." : "This IPC could not be loaded.";
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={[{ label: "IPCs", href: "/sales/ipcs" }, { label: "IPC" }]} />
        <Alert tone="destructive" title={msg} className="mt-4" data-testid="ipc-detail-error">
          <Button size="sm" variant="outline" className="mt-2" onClick={() => router.push("/sales/ipcs")}>Back to list</Button>
        </Alert>
      </div>
    );
  }

  if (isNew && !canWrite) {
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={[{ label: "IPCs", href: "/sales/ipcs" }, { label: "New" }]} />
        <Alert tone="destructive" title="You don't have permission to raise an IPC." className="mt-4" data-testid="ipc-403" />
      </div>
    );
  }

  const title = isNew ? "New IPC" : `IPC #${saved?.ipcSeqNo ?? ""}`;
  const crumbTail = isNew ? "New" : `IPC #${saved?.ipcSeqNo ?? ""}`;

  const rightColumn = (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <ComputedFiguresPanel
          values={form}
          errors={fieldErrors}
          currentlyDue={currentlyDue}
          negative={negative}
          remainingAdvance={remainingAdvance}
          hasMobilizationAdvance={hasMobilizationAdvance}
          readOnly={readOnly}
          onChange={onFigureChange}
        />
      </Card>
      <Card className="p-5">
        <LedgerEffectPreview
          values={form}
          currentlyDue={currentlyDue}
          settled={!!saved && saved.status === "POSTED" && !correcting}
          dims={{
            customerName,
            projectLabel: selectedProject?.projectCode ?? "",
            costCentreLabel: costCentres.find((c) => c.id === form.costCentreId)?.name ? `CC · ${costCentres.find((c) => c.id === form.costCentreId)!.name}` : "",
            purposeLabel: purposes.find((p) => p.id === form.purposeId)?.name ? `Purpose · ${purposes.find((p) => p.id === form.purposeId)!.name}` : "",
          }}
        />
      </Card>
    </div>
  );

  const captureCard = (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-token bg-primary text-[12px] font-bold text-primary-foreground">1</span>
        <h2 className="text-[14px] font-bold text-foreground">Certificate details</h2>
      </div>
      <IpcCaptureFields
        values={form}
        errors={fieldErrors}
        projects={projects}
        costCentres={costCentres}
        purposes={purposes}
        purposesLoading={purposesQuery.isLoading}
        customerName={customerName}
        readOnly={readOnly}
        onChange={patch}
        onAddPurpose={(name) =>
          createPurpose.mutate({ projectId: form.projectId, name }, { onSuccess: (p) => patch({ purposeId: p.id }) })
        }
      />
    </Card>
  );

  return (
    <div className="mx-auto max-w-6xl pb-28 lg:pb-24">
      <Breadcrumb items={[{ label: "IPCs", href: "/sales/ipcs" }, { label: crumbTail }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="ipc-editor-title">{title}</h1>
        {saved && <IpcStatusBadge status={correcting ? "DRAFT" : saved.status} />}
        {saved?.entryNo && !correcting && (
          <span className="inline-flex items-center rounded-pill bg-primary px-2.5 py-1 font-mono text-[12px] font-semibold text-primary-foreground" data-testid="ipc-entry-no">
            {saved.entryNo}
          </span>
        )}
      </div>

      {banner && <Alert tone="destructive" title={banner} className="mb-4" data-testid="ipc-banner" />}

      {readOnly && saved && (
        <Alert
          tone={saved.status === "CANCELLED" ? "warning" : "info"}
          title={saved.status === "CANCELLED" ? "This IPC has been cancelled." : "This IPC is posted and read-only."}
          className="mb-4"
          data-testid="ipc-readonly-banner"
        >
          <span className="text-[12.5px]">Corrections are made by reverse-and-repost — the original number is always retained.</span>
        </Alert>
      )}

      {correcting && (
        <Alert tone="warning" title="Correcting a posted IPC." className="mb-4" data-testid="ipc-correcting-banner">
          <span className="text-[12.5px]">Posting this reverses the original entry and posts the corrected figures as a new numbered entry.</span>
        </Alert>
      )}

      {posting && (
        <Alert tone="info" className="mb-4" data-testid="ipc-posting-banner" title="Posting — do not close this window.">
          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Allocating the gapless IPC number and writing the balanced ledger entry.
          </span>
        </Alert>
      )}

      {/* Summary strip (project · customer · work % · posting dimensions) */}
      {(selectedProject || saved) && (
        <Card className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4" data-testid="ipc-summary-strip">
          <SummaryItem label="Project" value={selectedProject ? `${selectedProject.projectCode} — ${selectedProject.name}` : saved?.projectId ?? "—"} />
          <SummaryItem label="Customer · resolved" value={customerName || "—"} />
          <SummaryItem label="Work completed" value={form.workCompletedPct ? `${trimPct(form.workCompletedPct)}% cumulative` : "—"} />
          <div className="ml-auto flex flex-wrap gap-1.5">
            {selectedProject && <DimPill>{selectedProject.projectCode}</DimPill>}
            {costCentres.find((c) => c.id === form.costCentreId) && <DimPill>CC · {costCentres.find((c) => c.id === form.costCentreId)!.name}</DimPill>}
            {purposes.find((p) => p.id === form.purposeId) && <DimPill>Purpose · {purposes.find((p) => p.id === form.purposeId)!.name}</DimPill>}
          </div>
        </Card>
      )}

      {/* Body — two-column on desktop; single column (figures collapsible on phone) below */}
      {isDesktop ? (
        <div className="grid grid-cols-[1.6fr_1fr] items-start gap-5">
          {captureCard}
          <div className="sticky top-4">{rightColumn}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {captureCard}
          {isPhone ? (
            <>
              <button
                type="button"
                className="flex items-center justify-between rounded-card bg-primary px-4 py-3 text-primary-foreground"
                aria-expanded={figuresOpen}
                onClick={() => setFiguresOpen((o) => !o)}
                data-testid="ipc-mobile-summary"
              >
                <span className="flex flex-col items-start">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-primary-foreground/70">Currently due</span>
                  <span className="font-mono text-[16px] font-bold tabular-nums">{formatMoney(currentlyDue)}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[12px] text-primary-foreground/80">
                  tap to expand
                  <ChevronDown className={cn("h-4 w-4 transition-transform", figuresOpen && "rotate-180")} aria-hidden />
                </span>
              </button>
              {figuresOpen && rightColumn}
            </>
          ) : (
            rightColumn
          )}
        </div>
      )}

      {/* Fixed action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-3 shadow-lg lg:pl-[var(--sidebar-w,0)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p className="hidden max-w-lg text-[12.5px] text-muted-foreground sm:block">
            {correcting
              ? "Correcting — posting reverses the original and posts the correction."
              : readOnly
                ? "Posted vouchers are immutable. Corrections are reverse-and-repost."
                : "Draft — no ledger impact and no number yet. The gapless IPC number is allocated only when you Post."}
          </p>
          <div className="ml-auto flex items-center gap-2">
            {editable ? (
              <>
                {correcting && (
                  <Button variant="ghost" size="md" onClick={() => setCorrecting(false)} disabled={busy} data-testid="ipc-cancel-correction">
                    Cancel correction
                  </Button>
                )}
                {!correcting && saved?.id && (
                  <Button variant="ghost" size="md" onClick={() => setDiscardOpen(true)} disabled={busy} data-testid="ipc-discard">
                    Discard draft
                  </Button>
                )}
                {!correcting && (
                  <Button variant="outline" size="md" onClick={onSaveDraft} disabled={busy} data-testid="ipc-save">Save draft</Button>
                )}
                {correcting ? (
                  <Button size="md" onClick={onRepostClick} disabled={busy || !postReady} data-testid="ipc-repost">Post correction</Button>
                ) : (
                  canPost && (
                    <Button size="md" className="gap-1.5" onClick={onPostClick} disabled={busy || !postReady} data-testid="ipc-post">Post</Button>
                  )
                )}
              </>
            ) : (
              saved && (
                <>
                  {(saved.status === "POSTED" || saved.status === "CANCELLED") && (
                    <Button variant="outline" size="md" className="gap-1.5" asChild data-testid="ipc-print">
                      <a href={`/sales/ipcs/${saved.id}/view`}>
                        <Printer className="h-4 w-4" aria-hidden />
                        Print
                      </a>
                    </Button>
                  )}
                  {saved.status === "POSTED" && canCancel && (
                    <>
                      <Button variant="outline" size="md" onClick={() => setCorrecting(true)} disabled={busy} data-testid="ipc-correct">Repost / correct</Button>
                      <Button variant="destructive" size="md" onClick={() => setCancelOpen(true)} disabled={busy} data-testid="ipc-cancel">Cancel IPC</Button>
                    </>
                  )}
                </>
              )
            )}
          </div>
        </div>
      </div>

      <PostDialog open={postOpen} currentlyDue={currentlyDue} busy={busy} onConfirm={onPostConfirm} onCancel={() => setPostOpen(false)} />
      <CancelDialog open={cancelOpen} busy={busy} onConfirm={onCancelConfirm} onCancel={() => setCancelOpen(false)} />
      <RepostDialog open={repostOpen} currentlyDue={currentlyDue} busy={busy} onConfirm={onRepostConfirm} onCancel={() => setRepostOpen(false)} />
      <DiscardDraftDialog open={discardOpen} busy={busy} onConfirm={onDiscardConfirm} onCancel={() => setDiscardOpen(false)} />
    </div>
  );
}

/** Trim a percentage's trailing decimal zeros for display ("45.0000" → "45", "62.5000" → "62.5"). */
function trimPct(v: string): string {
  if (!v.includes(".")) return v;
  return v.replace(/0+$/, "").replace(/\.$/, "");
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[14px] font-medium text-foreground [overflow-wrap:anywhere]">{value}</div>
    </div>
  );
}

function DimPill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-pill bg-accent-soft px-2.5 py-1 text-[11.5px] font-medium text-accent-ink">{children}</span>;
}
