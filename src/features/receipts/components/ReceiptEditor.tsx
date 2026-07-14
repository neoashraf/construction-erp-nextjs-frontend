"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useOnline } from "@/lib/hooks/use-online";
import { asApiError } from "@/lib/api";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canPostReceipt, canWriteReceipt } from "../access";
import { useReceipt } from "../hooks/useReceipt";
import { useReceiptMutations } from "../hooks/useReceiptMutations";
import { useIpcOutstanding } from "../hooks/useIpcOutstanding";
import {
  useAccountOptions,
  useCostCentreOptions,
  useCustomerOptions,
  useIpcDetail,
  usePostedIpcsForCustomer,
  useProjectOptions,
  usePurposeOptions,
} from "../hooks/useReceiptEditorOptions";
import {
  derivedCashReceived,
  emptyReceiptForm,
  formToWriteInput,
  isPostable,
  isReceiptEditable,
  mapReceiptError,
  receiptToForm,
  validateReceipt,
  type FieldErrors,
  type ReceiptFormValues,
} from "../schemas/receipt.schema";
import { type ReceiptType } from "../types";
import { ReceiptModePicker } from "./ReceiptModePicker";
import { ReceiptHeaderFields } from "./ReceiptHeaderFields";
import { IpcLinkedBlock } from "./IpcLinkedBlock";
import { GeneralReceiptBlock } from "./GeneralReceiptBlock";
import { ReceiptMoneyBlock } from "./ReceiptMoneyBlock";
import { BalanceDuePanel } from "./BalanceDuePanel";
import { PostReceiptDialog } from "./PostReceiptDialog";
import { DiscardDraftDialog } from "./DiscardDraftDialog";

/**
 * Receipt editor / DRAFT capture (spec §4/§6; FR-REC-001…-020, -024). A blank DRAFT for
 * `"new"`, else the loaded receipt — editable only while DRAFT. **A POSTED/CANCELLED
 * receipt never opens here** — the route redirects to `/receipts/[id]/view`. The mode
 * picker (create only) fixes IPC-linked vs general; both share the header + money block.
 * Post is server-confirmed behind the mandatory PostReceiptDialog (atomic — allocates the
 * gapless number). Cancel/repost live on FE-44 (viewer).
 */
export function ReceiptEditor({ receiptId }: { receiptId: string | null }) {
  const router = useRouter();
  const online = useOnline();
  const { toast } = useToast();
  const user = useAuthenticatedUser();
  const canWrite = canWriteReceipt(user);
  const canPost = canPostReceipt(user);

  const isNew = receiptId === null;
  const detail = useReceipt(receiptId);
  const saved = detail.data;

  const [form, setForm] = useState<ReceiptFormValues>(emptyReceiptForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [savingBusy, setSavingBusy] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const { create, update, remove, post } = useReceiptMutations();

  // Option queries.
  const accountsQ = useAccountOptions();
  const customersQ = useCustomerOptions();
  const projectsQ = useProjectOptions();
  const costCentresQ = useCostCentreOptions();
  const postedIpcsQ = usePostedIpcsForCustomer(form.customerId);
  const ipcDetailQ = useIpcDetail(form.ipcId);
  const outstandingQ = useIpcOutstanding(form.ipcId || null);
  // Purposes are project-scoped. In IPC-linked mode the project comes from the picked
  // IPC (`ipcDetail.projectId`) so the inherited-purpose chip can name-resolve; in
  // general mode the user picks a project explicitly (`form.projectId`).
  const effectiveProjectId =
    form.receiptType === "IPC_LINKED" ? (ipcDetailQ.data?.projectId ?? "") : form.projectId;
  const purposesQ = usePurposeOptions(effectiveProjectId);

  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);
  const customers = useMemo(() => customersQ.data ?? [], [customersQ.data]);
  const projects = useMemo(() => projectsQ.data ?? [], [projectsQ.data]);
  const costCentres = useMemo(() => costCentresQ.data ?? [], [costCentresQ.data]);
  const purposes = useMemo(() => purposesQ.data ?? [], [purposesQ.data]);
  const postedIpcs = postedIpcsQ.data ?? [];
  const ipcDetail = ipcDetailQ.data;
  const outstanding = outstandingQ.data?.balanceDue ?? null;

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const costCentreMap = useMemo(() => new Map(costCentres.map((c) => [c.id, c])), [costCentres]);
  const purposeMap = useMemo(() => new Map(purposes.map((p) => [p.id, p])), [purposes]);

  // Redirect a posted/cancelled id straight to the viewer (FR-REC-024).
  useEffect(() => {
    if (saved && saved.status !== "DRAFT") {
      router.replace(`/receipts/${saved.id}/view`);
    }
  }, [saved, router]);

  // Pre-fill the form once a DRAFT loads (edit entry).
  useEffect(() => {
    if (!saved) return;
    if (saved.status !== "DRAFT") return;
    setForm(receiptToForm(saved));
  }, [saved]);

  const readOnly = !!saved && !isReceiptEditable(saved.status);
  const canEdit = !readOnly && (isNew ? canWrite : canWrite) && !posting;
  const busy = savingBusy || posting;

  // Pull the picked-IPC's inherited-dimension names for chip display. Names come from
  // the IPC detail (server-confirmed) crossed with the local options for a display label.
  const inheritedProjectName = ipcDetail
    ? projectMap.get(ipcDetail.projectId)?.name ??
      (ipcDetail.projectId ? `${ipcDetail.projectId.slice(0, 8)} (name unavailable)` : "")
    : "";
  const inheritedCostCentreName = ipcDetail
    ? costCentreMap.get(ipcDetail.costCentreId)?.name ??
      (ipcDetail.costCentreId ? `${ipcDetail.costCentreId.slice(0, 8)} (name unavailable)` : "")
    : "";
  // Purposes are project-scoped; for the inherited chip we can only look them up after
  // the project's purposes list has loaded. Fall back to the id when the list hasn't
  // populated yet (partial-data state, spec §6).
  const inheritedPurposeName = ipcDetail
    ? purposeMap.get(ipcDetail.purposeId)?.name ??
      (ipcDetail.purposeId ? `${ipcDetail.purposeId.slice(0, 8)} (name unavailable)` : "")
    : "";

  const postReady = canEdit && isPostable(form, outstanding);

  function patch(p: Partial<ReceiptFormValues>) {
    setBanner(null);
    setForm((prev) => ({ ...prev, ...p }));
    setFieldErrors((prev) => {
      const copy = { ...prev };
      for (const k of Object.keys(p)) delete copy[k as keyof ReceiptFormValues];
      return copy;
    });
  }

  function pickMode(mode: ReceiptType) {
    // Pre-save mode-swap is free (Open item 2). Once persisted the picker is hidden.
    if (saved) return;
    setBanner(null);
    setFieldErrors({});
    setForm((prev) => ({
      ...prev,
      receiptType: mode,
      // Wipe the other-mode fields so a subsequent Save doesn't ship stale IDs.
      customerId: mode === "IPC_LINKED" ? prev.customerId : "",
      ipcId: mode === "IPC_LINKED" ? prev.ipcId : "",
      taxDeductedAtSource: mode === "IPC_LINKED" ? prev.taxDeductedAtSource : "0.0000",
      partyId: mode === "GENERAL" ? prev.partyId : "",
      generalTargetAccountId: mode === "GENERAL" ? prev.generalTargetAccountId : "",
      projectId: mode === "GENERAL" ? prev.projectId : "",
      costCentreId: mode === "GENERAL" ? prev.costCentreId : "",
      purposeId: mode === "GENERAL" ? prev.purposeId : "",
    }));
  }

  function applyServerError(err: unknown) {
    const e = asApiError(err);
    const mapped = mapReceiptError(e.code, { outstanding });
    if (mapped.field) {
      setFieldErrors((prev) => ({ ...prev, [mapped.field as keyof ReceiptFormValues]: mapped.message }));
    }
    setBanner(mapped.message);
  }

  function validate(): ReceiptFormValues | null {
    const res = validateReceipt(form, { outstanding });
    if (res.errors === null) {
      setFieldErrors({});
      return res.values;
    }
    setFieldErrors(res.errors);
    return null;
  }

  async function persist(values: ReceiptFormValues): Promise<{ id: string; version: number } | null> {
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
      setBanner("You're offline. Changes weren't saved.");
      return;
    }
    setBanner(null);
    const values = validate();
    if (!values) return;
    setSavingBusy(true);
    const res = await persist(values);
    setSavingBusy(false);
    if (!res) return;
    toast("Draft saved.", "success");
    if (isNew) router.replace(`/receipts/${res.id}`);
  }

  function onPostClick() {
    if (!online) {
      setBanner("You're offline. Changes weren't saved.");
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
    setSavingBusy(true);
    setPosting(true);
    const res = await persist(values);
    if (!res) {
      setSavingBusy(false);
      setPosting(false);
      setPostOpen(false);
      return;
    }
    try {
      const result = await post.mutateAsync({ id: res.id, version: res.version });
      setPostOpen(false);
      toast(`Receipt posted — ${result.entryNo}.`, "success");
      router.replace(`/receipts/${res.id}/view`);
    } catch (err) {
      setPostOpen(false);
      applyServerError(err);
    } finally {
      setSavingBusy(false);
      setPosting(false);
    }
  }

  async function onDiscardConfirm() {
    if (!saved) return;
    setSavingBusy(true);
    try {
      await remove.mutateAsync({ id: saved.id });
      setDiscardOpen(false);
      toast("Draft discarded.", "success");
      router.push("/receipts");
    } catch (err) {
      setDiscardOpen(false);
      applyServerError(err);
    } finally {
      setSavingBusy(false);
    }
  }

  // ── Guarded render paths ────────────────────────────────────────────────────────────

  if (receiptId && detail.isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 mt-1 flex flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <Card className="flex flex-col gap-4 p-5" data-testid="receipt-loading">
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

  if (receiptId && detail.isError) {
    const e = asApiError(detail.error);
    const msg = e.code === "FORBIDDEN" ? "You don't have access to this receipt." : "This receipt could not be loaded.";
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={[{ label: "Receipts", href: "/receipts" }, { label: "Receipt" }]} />
        <Alert tone="destructive" title={msg} className="mt-4" data-testid="receipt-detail-error">
          <Button size="sm" variant="outline" className="mt-2" onClick={() => router.push("/receipts")}>Back to list</Button>
        </Alert>
      </div>
    );
  }

  if (isNew && !canWrite) {
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={[{ label: "Receipts", href: "/receipts" }, { label: "New" }]} />
        <Alert
          tone="destructive"
          title="You don't have permission to create receipts."
          className="mt-4"
          data-testid="receipt-403"
        />
      </div>
    );
  }

  // Loading-skeleton headline options.
  const optionsLoading =
    accountsQ.isLoading || customersQ.isLoading || projectsQ.isLoading || costCentresQ.isLoading;

  const title = isNew ? "New receipt" : "Edit receipt (draft)";
  const crumbTail = isNew ? "New receipt" : "Edit";
  const isIpc = form.receiptType === "IPC_LINKED";
  const isGen = form.receiptType === "GENERAL";
  const modeChosen = !!form.receiptType;
  const disabledFields = !canEdit;

  const cashReceived = derivedCashReceived(form);

  return (
    <div className="relative mx-auto max-w-6xl pb-28 lg:pb-24">
      <Breadcrumb items={[{ label: "Receipts", href: "/receipts" }, { label: crumbTail }]} />

      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="receipt-editor-title">
          {title}
        </h1>
        <Badge tone="warning" data-testid="receipt-status-badge">Draft</Badge>
      </div>

      {!online && (
        <Alert tone="warning" title="You're offline. Changes weren't saved." className="mb-4" data-testid="receipt-offline-banner" />
      )}

      {banner && (
        <Alert tone="destructive" title={banner} className="mb-4" data-testid="receipt-banner" />
      )}

      {!canPost && canWrite && (
        <Alert
          tone="info"
          title="You don't have permission to post receipts."
          className="mb-4"
          data-testid="receipt-post-denied-banner"
        >
          <span className="text-[12.5px]">You can still save a draft — an Accounts Manager will post it.</span>
        </Alert>
      )}

      {/* Mode picker (create only). Once persisted the picker is hidden and mode is fixed. */}
      {!saved && (
        <Card className="mb-4 p-5" data-testid="receipt-mode-picker-card">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-token bg-primary text-[12px] font-bold text-primary-foreground">1</span>
            <h2 className="text-[14px] font-bold text-foreground">Mode</h2>
          </div>
          <ReceiptModePicker value={form.receiptType} onChange={pickMode} disabled={disabledFields} />
          {fieldErrors.receiptType && (
            <p className="mt-2 text-[12px] font-medium text-destructive" data-testid="receipt-mode-err">
              {fieldErrors.receiptType}
            </p>
          )}
        </Card>
      )}

      {/* Body — two-column on desktop; single column below. */}
      {modeChosen && (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="flex flex-col gap-5">
            <Card className="p-5" data-testid="receipt-header-card">
              <div className="mb-4 flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-token bg-primary text-[12px] font-bold text-primary-foreground">{saved ? "1" : "2"}</span>
                <h2 className="text-[14px] font-bold text-foreground">Payment</h2>
              </div>
              {optionsLoading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
                </div>
              ) : (
                <ReceiptHeaderFields
                  values={form}
                  errors={fieldErrors}
                  accounts={accounts}
                  disabled={disabledFields}
                  onChange={patch}
                />
              )}
            </Card>

            {isIpc && (
              <Card className="p-5" data-testid="receipt-ipc-card">
                <div className="mb-4 flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-token bg-primary text-[12px] font-bold text-primary-foreground">{saved ? "2" : "3"}</span>
                  <h2 className="text-[14px] font-bold text-foreground">Reference</h2>
                  <span className="ml-auto inline-flex items-center gap-1 rounded-pill bg-info-soft px-2.5 py-0.5 text-[10.5px] font-semibold text-info">
                    IPC-linked
                  </span>
                </div>
                <IpcLinkedBlock
                  values={form}
                  errors={fieldErrors}
                  customers={customers}
                  postedIpcs={postedIpcs}
                  ipcsLoading={postedIpcsQ.isLoading}
                  ipcDetail={ipcDetail}
                  ipcDetailLoading={ipcDetailQ.isLoading}
                  projectName={inheritedProjectName}
                  costCentreName={inheritedCostCentreName}
                  purposeName={inheritedPurposeName}
                  disabled={disabledFields}
                  onChange={patch}
                />
              </Card>
            )}

            {isGen && (
              <Card className="p-5" data-testid="receipt-general-card">
                <div className="mb-4 flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-token bg-primary text-[12px] font-bold text-primary-foreground">{saved ? "2" : "3"}</span>
                  <h2 className="text-[14px] font-bold text-foreground">Allocation</h2>
                  <span className="ml-auto inline-flex items-center gap-1 rounded-pill bg-muted px-2.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                    General
                  </span>
                </div>
                <GeneralReceiptBlock
                  values={form}
                  errors={fieldErrors}
                  parties={customers}
                  accounts={accounts}
                  projects={projects}
                  costCentres={costCentres}
                  purposes={purposes}
                  purposesLoading={purposesQ.isLoading}
                  disabled={disabledFields}
                  onChange={patch}
                />
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-4 lg:sticky lg:top-4">
            <Card className="p-4" data-testid="receipt-money-card">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-token bg-primary text-[12px] font-bold text-primary-foreground">{saved ? (isIpc || isGen ? "3" : "2") : "4"}</span>
                <h2 className="text-[14px] font-bold text-foreground">Amount</h2>
                <span className="ml-auto text-[10.5px] text-muted-foreground">Decimal(18,4)</span>
              </div>
              <ReceiptMoneyBlock
                values={form}
                errors={fieldErrors}
                disabled={disabledFields}
                onChange={patch}
              />
            </Card>

            {isIpc && form.ipcId && (
              <BalanceDuePanel
                outstanding={outstanding}
                amountSettled={form.amountSettled || "0"}
                loading={outstandingQ.isLoading}
              />
            )}
          </div>
        </div>
      )}

      {/* Fixed action bar. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-3 shadow-lg lg:pl-[var(--sidebar-w,0)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <p className="hidden max-w-lg text-[12.5px] text-muted-foreground sm:block">
            Draft — no ledger impact and no number yet. The gapless RECEIPT number is allocated only when you Post.
          </p>
          <div className="ml-auto flex items-center gap-2">
            {saved?.id && (
              <Button
                variant="ghost"
                size="md"
                onClick={() => setDiscardOpen(true)}
                disabled={busy || !canEdit}
                data-testid="receipt-discard"
              >
                Discard draft
              </Button>
            )}
            <Button
              variant="outline"
              size="md"
              onClick={() => router.push("/receipts")}
              disabled={busy}
              data-testid="receipt-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={onSaveDraft}
              disabled={busy || !canEdit || !modeChosen}
              data-testid="receipt-save"
            >
              {savingBusy && !posting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save draft"
              )}
            </Button>
            <Button
              size="md"
              onClick={onPostClick}
              disabled={busy || !canEdit || !canPost || !postReady}
              title={!canPost ? "You don't have permission to post receipts." : undefined}
              className="gap-1.5"
              data-testid="receipt-post"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
              Post
            </Button>
          </div>
        </div>
      </div>

      {/* In-flight posting lock (spec §6 Saving/posting; design "in-flight lock"). */}
      {posting && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-canvas/60 pt-32"
          role="alertdialog"
          aria-modal="true"
          aria-label="Posting"
          data-testid="receipt-posting-overlay"
        >
          <div className="flex items-center gap-3 rounded-card border border-info-soft bg-surface px-5 py-4 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-info" aria-hidden />
            <div>
              <div className="text-[13.5px] font-bold text-info">Posting… do not close this window.</div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                Allocating the gapless receipt number and writing the balanced ledger entry.
              </div>
            </div>
          </div>
        </div>
      )}

      <PostReceiptDialog
        open={postOpen}
        amountSettled={form.amountSettled || "0"}
        cashReceived={cashReceived}
        busy={savingBusy || posting}
        onConfirm={onPostConfirm}
        onCancel={() => setPostOpen(false)}
      />
      <DiscardDraftDialog
        open={discardOpen}
        busy={savingBusy}
        onConfirm={onDiscardConfirm}
        onCancel={() => setDiscardOpen(false)}
      />
    </div>
  );
}
