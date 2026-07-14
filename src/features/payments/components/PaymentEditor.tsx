"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, Repeat, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { asApiError } from "@/lib/api/errors";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { AlertCircle, Lock, Search } from "lucide-react";
import { canCancelPayment, canPostPayment, canWritePayment } from "../access";
import { usePayment } from "../hooks/usePayment";
import { usePaymentEditorMutations } from "../hooks/usePaymentEditorMutations";
import {
  listAccountOptions,
  listCostCentreOptions,
  listPartyOptions,
  listProjectOptions,
  listPurposeOptions,
} from "../api/masters";
import {
  allocatedTotal,
  emptyPaymentForm,
  formToWriteInput,
  isPostable,
  mapPaymentError,
  paymentToForm,
  validatePayment,
  type AllocationRow,
  type FieldErrors,
  type PaymentFormValues,
} from "../schemas/payment.schema";
import { type OpenPayable } from "../types";
import { PaymentHeaderFields } from "./PaymentHeaderFields";
import { AllocationGrid } from "./AllocationGrid";
import { OpenPayablesPicker } from "./OpenPayablesPicker";
import { DailyLabourSettlementPanel } from "./DailyLabourSettlementPanel";
import { BankChargesBlock } from "./BankChargesBlock";
import { PaymentTotalsFooter } from "./PaymentTotalsFooter";
import { PostPaymentDialog } from "./PostPaymentDialog";
import { CancelPaymentDialog } from "./CancelPaymentDialog";
import { PayeeChangeDialog } from "./PayeeChangeDialog";
import { DeleteDraftDialog } from "./DeleteDraftDialog";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

/**
 * Payment editor — draft capture + allocation + post/cancel/correct (spec §4/§6/§9;
 * FR-PAY-001…-020). One `status`-driven surface: editable while DRAFT, fully read-only
 * once POSTED/CANCELLED (only Cancel/Correct actions remain). Post is server-confirmed
 * behind a mandatory confirm dialog + Phase-1 full-allocation gate.
 */
export function PaymentEditor({ paymentId }: { paymentId: string | null }) {
  const router = useRouter();
  const online = useOnline();
  const { toast } = useToast();
  const user = useAuthenticatedUser();
  const canWrite = canWritePayment(user);
  const canPost = canPostPayment(user);
  const canCancel = canCancelPayment(user);

  const isNew = paymentId === null;
  const detail = usePayment(paymentId);
  const saved = detail.data;

  const [form, setForm] = useState<PaymentFormValues>(emptyPaymentForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [savingBusy, setSavingBusy] = useState(false);
  const [posting, setPosting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingPartyId, setPendingPartyId] = useState<string | null>(null);
  const [postOpen, setPostOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const { create, update, remove, post, cancel } = usePaymentEditorMutations();

  const scope = useMemo(
    () => ({ companyId: user.companyId, financialYearId: user.financialYearId }),
    [user.companyId, user.financialYearId],
  );
  const partiesQ = useQuery({
    queryKey: queryKeys.list("payments", "parties", scope, {}),
    queryFn: () => listPartyOptions(),
    staleTime: 60_000,
  });
  const accountsQ = useQuery({
    queryKey: queryKeys.list("payments", "accounts", scope, {}),
    queryFn: () => listAccountOptions(),
    staleTime: 60_000,
  });
  const projectsQ = useQuery({
    queryKey: queryKeys.list("payments", "projects", scope, {}),
    queryFn: () => listProjectOptions(),
    staleTime: 60_000,
  });
  const costCentresQ = useQuery({
    queryKey: queryKeys.list("payments", "cost-centres", scope, {}),
    queryFn: () => listCostCentreOptions(),
    staleTime: 60_000,
  });
  const purposesQ = useQuery({
    queryKey: queryKeys.list("payments", "purposes", scope, { projectId: form.bankChargesProjectId }),
    queryFn: () => listPurposeOptions(form.bankChargesProjectId),
    enabled: !!form.bankChargesProjectId,
    staleTime: 60_000,
  });

  const parties = partiesQ.data ?? [];
  const accounts = accountsQ.data ?? [];
  const projects = projectsQ.data ?? [];
  const costCentres = costCentresQ.data ?? [];
  const purposes = purposesQ.data ?? [];

  // Load existing saved payment into the form when it arrives.
  useEffect(() => {
    if (!saved) return;
    setForm(paymentToForm(saved));
  }, [saved]);

  const readOnly = !!saved && saved.status !== "DRAFT";
  const canEdit = !readOnly && canWrite && !posting;
  const busy = savingBusy || posting;

  function patch(p: Partial<PaymentFormValues>) {
    setBanner(null);
    setForm((prev) => ({ ...prev, ...p }));
    setFieldErrors((prev) => {
      const copy = { ...prev };
      for (const k of Object.keys(p)) delete copy[k as keyof PaymentFormValues];
      return copy;
    });
  }

  function onPayeeChangeAttempt(nextPartyId: string) {
    if (nextPartyId === form.partyId) return;
    if (form.allocations.length > 0 && form.partyId) {
      setPendingPartyId(nextPartyId);
      return;
    }
    patch({ partyId: nextPartyId, allocations: [] });
  }
  function confirmPayeeChange() {
    if (pendingPartyId === null) return;
    patch({ partyId: pendingPartyId, allocations: [] });
    setPendingPartyId(null);
  }

  function addAllocation(row: OpenPayable) {
    const key = `${row.payableType}:${row.payableId}`;
    setForm((prev) => ({
      ...prev,
      allocations: [
        ...prev.allocations,
        {
          key,
          payableType: row.payableType,
          payableId: row.payableId,
          reference: row.reference,
          originalAmount: row.originalAmount,
          remainingOutstanding: row.remainingOutstanding,
          accruedAmount: row.accruedAmount,
          amountAllocated: row.remainingOutstanding,
        },
      ],
    }));
    setBanner(null);
    setPickerOpen(false);
  }
  function changeAllocationAmount(key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      allocations: prev.allocations.map((a) => (a.key === key ? { ...a, amountAllocated: value } : a)),
    }));
    setBanner(null);
  }
  function removeAllocation(key: string) {
    setForm((prev) => ({ ...prev, allocations: prev.allocations.filter((a) => a.key !== key) }));
  }

  function applyServerError(err: unknown) {
    const e = asApiError(err);
    const mapped = mapPaymentError(e.code);
    if (mapped.field) {
      setFieldErrors((prev) => ({ ...prev, [mapped.field as keyof FieldErrors]: mapped.message }));
    }
    setBanner(mapped.message);
  }
  function validate(): PaymentFormValues | null {
    const res = validatePayment(form);
    if (res.errors === null) {
      setFieldErrors({});
      return res.values;
    }
    setFieldErrors(res.errors);
    return null;
  }

  async function persist(values: PaymentFormValues): Promise<{ id: string; version: number } | null> {
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
    if (isNew) router.replace(`/payments/${res.id}`);
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
      toast(`Payment posted — ${result.entryNo}.`, "success");
      router.replace(`/payments/${res.id}/view`);
    } catch (err) {
      setPostOpen(false);
      applyServerError(err);
    } finally {
      setSavingBusy(false);
      setPosting(false);
    }
  }

  async function onCancelConfirm(reason: string) {
    if (!saved) return;
    setSavingBusy(true);
    try {
      const result = await cancel.mutateAsync({ id: saved.id, reason, version: saved.version });
      setCancelOpen(false);
      toast(`Payment cancelled — reversal ${result.reversalEntryNo} recorded.`, "success");
    } catch (err) {
      setCancelOpen(false);
      applyServerError(err);
    } finally {
      setSavingBusy(false);
    }
  }

  async function onDiscardConfirm() {
    if (!saved) return;
    setSavingBusy(true);
    try {
      await remove.mutateAsync({ id: saved.id });
      setDiscardOpen(false);
      toast("Draft payment deleted.", "success");
      router.push("/payments");
    } catch (err) {
      setDiscardOpen(false);
      applyServerError(err);
    } finally {
      setSavingBusy(false);
    }
  }

  function onCorrectClick() {
    // Correction = same payment id, editor is pre-filled + POST /repost. Given the spec's
    // simpler UX ("routes to the editor pre-filled"), reuse the current state and let the
    // user Post — for Phase 1 we surface an inline instruction rather than a full repost
    // dialog + separate schema.
    setBanner(
      "Editing a correction of a posted payment is a Phase-2 workflow. Use Cancel + a new payment for now.",
    );
  }

  // ── Guarded render paths ────────────────────────────────────────────────────────────

  if (paymentId && detail.isLoading) return <LoadingShell />;
  if (paymentId && detail.isError) {
    const e = asApiError(detail.error);
    const notFound = e.code === "NOT_FOUND" || e.status === 404;
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={[{ label: "Payments", href: "/payments" }, { label: "Payment" }]} />
        <Card className="mt-6 p-10">
          <EmptyState
            icon={notFound ? Search : AlertCircle}
            title={notFound ? "Payment not found." : "Couldn't load this payment."}
            action={
              <Button size="md" onClick={() => router.push("/payments")} data-testid="payment-editor-back">Back</Button>
            }
          />
        </Card>
      </div>
    );
  }
  if (isNew && !canWrite) {
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={[{ label: "Payments", href: "/payments" }, { label: "New" }]} />
        <Card className="mt-6 p-10">
          <EmptyState
            icon={Lock}
            title="You don't have permission to create payments."
            description="Ask an Accounts Manager or Admin."
          />
        </Card>
      </div>
    );
  }

  const title = isNew ? "New payment" : readOnly ? `Payment ${saved?.entryNo ?? ""}` : "Edit payment (draft)";
  const crumbTail = isNew ? "New payment" : readOnly ? saved?.entryNo ?? "Payment" : "Edit";
  const postReady = canEdit && isPostable(form);

  return (
    <div className="relative mx-auto max-w-6xl pb-28 lg:pb-24" data-testid="payment-editor">
      <Breadcrumb items={[{ label: "Payments", href: "/payments" }, { label: crumbTail }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="payment-editor-title">
          {title}
        </h1>
        {saved && <PaymentStatusBadge status={saved.status} />}
        {saved?.entryNo && (
          <Badge tone="info" className="font-mono">
            {saved.entryNo}
          </Badge>
        )}
      </div>

      {!online && (
        <Alert tone="warning" title="You're offline. Changes weren't saved." className="mb-4" data-testid="payment-editor-offline" />
      )}
      {banner && (
        <Alert tone="destructive" title={banner} className="mb-4" data-testid="payment-editor-banner" />
      )}
      {readOnly && (
        <div className="mb-4 flex items-center gap-2 rounded-card border border-accent-soft bg-accent-soft/40 p-3 text-[12.5px] text-muted-foreground">
          <Lock className="h-4 w-4 text-accent-ink" aria-hidden />
          Posted payments can&rsquo;t be edited. Use Cancel or Correct to change this record.
        </div>
      )}

      <div className="flex flex-col gap-5">
        <Card className="p-5" data-testid="payment-header-card">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-token bg-primary text-[12px] font-bold text-primary-foreground">1</span>
            <h2 className="text-[14px] font-bold text-foreground">Payment</h2>
          </div>
          <PaymentHeaderFields
            values={form}
            errors={fieldErrors}
            parties={parties}
            accounts={accounts}
            disabled={!canEdit}
            onPayeeChangeAttempt={onPayeeChangeAttempt}
            onChange={patch}
          />
        </Card>

        <AllocationGrid
          rows={form.allocations}
          disabled={!canEdit}
          banner={fieldErrors.allocationsBanner}
          onAdd={() => setPickerOpen(true)}
          onChangeAmount={changeAllocationAmount}
          onRemove={removeAllocation}
          showLabourTrueUp={(row: AllocationRow) => <DailyLabourSettlementPanel row={row} />}
        />

        <BankChargesBlock
          values={form}
          errors={fieldErrors}
          projects={projects}
          costCentres={costCentres}
          purposes={purposes}
          disabled={!canEdit}
          onChange={patch}
        />

        <PaymentTotalsFooter
          paymentAmount={form.paymentAmount || "0"}
          bankChargesAmount={form.bankChargesAmount || "0"}
          rows={form.allocations}
          totalsId="payment-totals-region"
        />
      </div>

      {/* Fixed action bar. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-3 shadow-lg lg:pl-[var(--sidebar-w,0)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <p className="hidden max-w-lg text-[12.5px] text-muted-foreground sm:block">
            {readOnly
              ? "Posted — the ledger entry is immutable. Cancel or Correct to change it."
              : "Draft — no ledger impact and no number yet. Post writes the balanced entry."}
          </p>
          <div className="ml-auto flex items-center gap-2">
            {saved && !readOnly && canWrite && (
              <Button variant="ghost" size="md" onClick={() => setDiscardOpen(true)} disabled={busy} data-testid="payment-editor-discard">
                Discard draft
              </Button>
            )}
            <Button variant="outline" size="md" onClick={() => router.push("/payments")} disabled={busy} data-testid="payment-editor-cancel">
              Cancel
            </Button>
            {!readOnly && canWrite && (
              <Button
                variant="outline"
                size="md"
                onClick={onSaveDraft}
                disabled={busy || !canEdit}
                data-testid="payment-editor-save"
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
            )}
            {!readOnly && canPost && (
              <Button
                size="md"
                onClick={onPostClick}
                disabled={busy || !canEdit || !postReady}
                aria-describedby="payment-totals-region"
                title={!postReady && form.allocations.length > 0 ? "Allocate the full amount to post." : undefined}
                className="gap-1.5"
                data-testid="payment-editor-post"
              >
                <ArrowRight className="h-4 w-4" aria-hidden />
                Post
              </Button>
            )}
            {readOnly && saved && saved.status === "POSTED" && canCancel && (
              <>
                <Button
                  variant="outline"
                  size="md"
                  onClick={onCorrectClick}
                  disabled={busy}
                  data-testid="payment-editor-correct"
                >
                  <Repeat className="h-4 w-4" aria-hidden />
                  Correct
                </Button>
                <Button
                  variant="outline"
                  className="border-destructive/40 text-destructive-ink hover:bg-destructive-soft"
                  size="md"
                  onClick={() => setCancelOpen(true)}
                  disabled={busy}
                  data-testid="payment-editor-cancel-btn"
                >
                  <XCircle className="h-4 w-4" aria-hidden />
                  Cancel payment
                </Button>
              </>
            )}
            {readOnly && saved && (
              <Button variant="outline" size="md" asChild data-testid="payment-editor-view">
                <Link href={`/payments/${saved.id}/view`}>View posted</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {posting && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-canvas/60 pt-32"
          role="alertdialog"
          aria-modal="true"
          aria-label="Posting"
          data-testid="payment-editor-posting-overlay"
        >
          <div className="flex items-center gap-3 rounded-card border border-info-soft bg-surface px-5 py-4 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-info" aria-hidden />
            <div>
              <div className="text-[13.5px] font-bold text-info">Posting… do not close this window.</div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                Allocating the gapless payment number and writing the balanced ledger entry.
              </div>
            </div>
          </div>
        </div>
      )}

      <OpenPayablesPicker
        open={pickerOpen}
        partyId={form.partyId}
        excludeIds={form.allocations.map((a) => a.key)}
        onPick={addAllocation}
        onClose={() => setPickerOpen(false)}
      />
      <PostPaymentDialog
        open={postOpen}
        paymentAmount={form.paymentAmount || "0"}
        allocated={allocatedTotal(form.allocations)}
        busy={savingBusy || posting}
        onConfirm={onPostConfirm}
        onCancel={() => setPostOpen(false)}
      />
      <CancelPaymentDialog
        open={cancelOpen}
        busy={savingBusy}
        onConfirm={onCancelConfirm}
        onCancel={() => setCancelOpen(false)}
      />
      <PayeeChangeDialog
        open={pendingPartyId !== null}
        onConfirm={confirmPayeeChange}
        onCancel={() => setPendingPartyId(null)}
      />
      <DeleteDraftDialog
        open={discardOpen}
        busy={savingBusy}
        onConfirm={onDiscardConfirm}
        onCancel={() => setDiscardOpen(false)}
      />
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 mt-1 flex flex-col gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Card className="mt-3 flex flex-col gap-3 p-5" data-testid="payment-editor-loading">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </Card>
      <Card className="mt-3 flex flex-col gap-3 p-5">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </Card>
    </div>
  );
}
