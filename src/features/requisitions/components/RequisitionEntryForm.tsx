"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { toDecimal } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { useOnline } from "@/lib/hooks/use-online";
import { asApiError } from "@/lib/api";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canSubmitRequisition, canWriteRequisition } from "../access";
import { useRequisition } from "../hooks/useRequisition";
import { useRequisitionMutations } from "../hooks/useRequisitionMutations";
import {
  useBudgetCheck,
  useCostCentreOptions,
  useCreatePurpose,
  useGodownOptions,
  useIndicativeRates,
  useItemOptions,
  useProjectOptions,
  usePurposeOptions,
} from "../hooks/useRequisitionOptions";
import {
  emptyRequisitionForm,
  formToWriteInput,
  isEditable,
  mapRequisitionError,
  requisitionFormSchema,
  STATUS_LABEL,
  type RequisitionFormValues,
} from "../schemas/requisition.schema";
import { RequisitionHeaderFields } from "./RequisitionHeaderFields";
import { MaterialLinesGrid } from "./MaterialLinesGrid";
import { EstimatedValueSummary } from "./EstimatedValueSummary";
import { RequisitionLinesReadOnly } from "./RequisitionLinesReadOnly";
import { RequisitionStatusBadge } from "./RequisitionStatusBadge";
import { type LineError } from "./MaterialLineCard";
import { type Requisition } from "../types";

type FieldErrors = Partial<Record<keyof RequisitionFormValues, string>>;

function isoToUi(iso: string): string {
  try {
    return formatDate(iso);
  } catch {
    return "";
  }
}

/**
 * Requisition entry form / viewer (spec §4/§6; FR-REQ-001…-009). A blank DRAFT for `"new"`,
 * else the loaded requisition — editable only while DRAFT, otherwise a read-only viewer with
 * the submitted banner (no return-to-draft, per Open items). Live estimated value + advisory
 * over-budget badge (both server-derived, never blocking). Save persists a DRAFT; Submit is
 * server-confirmed behind a confirm dialog, allocates `requisitionNo`, and redirects to the list.
 */
export function RequisitionEntryForm({ requisitionId }: { requisitionId: string | null }) {
  const router = useRouter();
  const online = useOnline();
  const { toast } = useToast();
  const user = useAuthenticatedUser();
  const canWrite = canWriteRequisition(user);
  const canSubmit = canSubmitRequisition(user);

  const isNew = requisitionId === null;
  const detail = useRequisition(requisitionId);
  const saved: Requisition | undefined = detail.data;

  const [form, setForm] = useState<RequisitionFormValues>(emptyRequisitionForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [lineErrors, setLineErrors] = useState<LineError[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { create, update, submit } = useRequisitionMutations();

  // Populate the form once the saved requisition loads (edit / view).
  useEffect(() => {
    if (!saved) return;
    setForm({
      projectId: saved.projectId,
      costCentreId: saved.costCentreId,
      purposeId: saved.purposeId,
      fromGodownId: saved.fromGodownId ?? "",
      requiredDate: isoToUi(saved.requiredDate),
      priority: saved.priority,
      narration: saved.narration ?? "",
      lines: (saved.lines ?? []).map((l) => ({ itemId: l.itemId, requestedQuantity: l.requestedQuantity })),
    });
  }, [saved]);

  const readOnly = !!saved && !isEditable(saved.status);
  const editable = !readOnly && canWrite;

  // Options.
  const projects = useProjectOptions().data ?? [];
  const costCentres = useCostCentreOptions().data ?? [];
  const items = useItemOptions().data ?? [];
  const purposesQuery = usePurposeOptions(form.projectId);
  const purposes = purposesQuery.data ?? [];
  const godowns = useGodownOptions(form.projectId || undefined).data ?? [];
  const createPurpose = useCreatePurpose();

  // Derived: indicative rates + estimated value + advisory budget check.
  const itemIds = form.lines.map((l) => l.itemId);
  const rates = useIndicativeRates(itemIds, form.fromGodownId);
  const estimating = form.lines.some((l, i) => l.itemId && rates[i]?.isLoading);
  const estimatedValue = useMemo(() => {
    if (estimating) return null;
    let sum = toDecimal("0");
    form.lines.forEach((l, i) => {
      const r = rates[i]?.rate;
      if (l.itemId && r != null && Number(l.requestedQuantity) > 0) {
        sum = sum.plus(toDecimal(l.requestedQuantity).times(toDecimal(r)));
      }
    });
    return sum.toFixed(4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.lines, rates, estimating]);
  const budget = useBudgetCheck(form.projectId, form.costCentreId, estimatedValue);

  function patch(p: Partial<RequisitionFormValues>) {
    setForm((prev) => {
      const next = { ...prev, ...p };
      // Changing the project re-scopes purpose + godown (FR-REQ-003).
      if (p.projectId !== undefined && p.projectId !== prev.projectId) {
        next.purposeId = "";
        next.fromGodownId = "";
      }
      return next;
    });
  }
  function changeLine(i: number, p: Partial<{ itemId: string; requestedQuantity: string }>) {
    setForm((prev) => ({ ...prev, lines: prev.lines.map((l, idx) => (idx === i ? { ...l, ...p } : l)) }));
  }
  function addLine() {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, { itemId: "", requestedQuantity: "" }] }));
  }
  function removeLine(i: number) {
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, idx) => idx !== i) }));
  }

  function validate(): RequisitionFormValues | null {
    const result = requisitionFormSchema.safeParse(form);
    if (result.success) {
      setFieldErrors({});
      setLineErrors([]);
      return result.data;
    }
    const fe: FieldErrors = {};
    const le: LineError[] = form.lines.map(() => ({}));
    for (const issue of result.error.issues) {
      const [head, idx, leaf] = issue.path;
      if (head === "lines" && typeof idx === "number") {
        const key = leaf === "itemId" ? "item" : "qty";
        le[idx] = { ...le[idx], [key]: issue.message };
      } else if (typeof head === "string" && head !== "lines") {
        fe[head as keyof RequisitionFormValues] = issue.message;
      } else if (head === "lines") {
        setBanner("Add at least one material line.");
      }
    }
    setFieldErrors(fe);
    setLineErrors(le);
    return null;
  }

  function applyServerError(err: unknown) {
    const e = asApiError(err);
    const mapped = mapRequisitionError(e.code);
    if (mapped.field && mapped.field !== "lines") {
      setFieldErrors((prev) => ({ ...prev, [mapped.field as keyof RequisitionFormValues]: mapped.message }));
    }
    setBanner(mapped.message);
  }

  /** Persist the current form as a DRAFT; returns {id, version} or null on failure. */
  async function persist(values: RequisitionFormValues): Promise<{ id: string; version: number } | null> {
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
      setBanner("You're offline. Your requisition wasn't saved.");
      return;
    }
    setBanner(null);
    const values = validate();
    if (!values) return;
    setBusy(true);
    const res = await persist(values);
    setBusy(false);
    if (!res) return;
    toast("Requisition saved as draft.", "success");
    if (isNew) router.replace(`/requisitions/${res.id}`);
  }

  function onSubmitClick() {
    if (!online) {
      setBanner("You're offline. Your requisition wasn't saved.");
      return;
    }
    setBanner(null);
    if (!validate()) return;
    setSubmitOpen(true);
  }

  async function onSubmitConfirm() {
    const values = validate();
    if (!values) {
      setSubmitOpen(false);
      return;
    }
    setBusy(true);
    const res = await persist(values);
    if (!res) {
      setBusy(false);
      setSubmitOpen(false);
      return;
    }
    try {
      await submit.mutateAsync({ id: res.id, version: res.version });
      setBusy(false);
      setSubmitOpen(false);
      toast("Requisition submitted for approval.", "success");
      router.push("/requisitions");
    } catch (err) {
      setBusy(false);
      setSubmitOpen(false);
      applyServerError(err);
    }
  }

  // ── Render ──
  if (requisitionId && detail.isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 mt-1 flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card className="flex flex-col gap-4 p-5">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          <Skeleton className="h-12 w-full" />
        </Card>
      </div>
    );
  }

  if (requisitionId && detail.isError) {
    const e = asApiError(detail.error);
    const msg = e.code === "FORBIDDEN" ? "You don't have access to this requisition." : "This requisition could not be loaded.";
    return (
      <div className="mx-auto max-w-4xl">
        <Breadcrumb items={[{ label: "Requisitions", href: "/requisitions" }, { label: "Requisition" }]} />
        <Alert tone="destructive" title={msg} className="mt-4" data-testid="req-detail-error">
          <Button size="sm" variant="outline" className="mt-2" onClick={() => router.push("/requisitions")}>Back to requisitions</Button>
        </Alert>
      </div>
    );
  }

  if (isNew && !canWrite) {
    return (
      <div className="mx-auto max-w-4xl">
        <Breadcrumb items={[{ label: "Requisitions", href: "/requisitions" }, { label: "New" }]} />
        <Alert tone="destructive" title="You don't have permission to raise a requisition." className="mt-4" data-testid="req-403" />
      </div>
    );
  }

  const title = isNew ? "New requisition" : readOnly ? saved?.requisitionNo ?? "Requisition" : "Edit requisition";
  const crumbTail = isNew ? "New" : saved?.requisitionNo ?? "Draft";

  return (
    <div className="mx-auto max-w-4xl pb-24 lg:pb-6">
      <Breadcrumb items={[{ label: "Requisitions", href: "/requisitions" }, { label: crumbTail }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold tracking-[-0.02em]" data-testid="req-form-title">{title}</h1>
        {saved && <RequisitionStatusBadge status={saved.status} />}
        {editable && (
          <div className="ml-auto hidden gap-2 lg:flex">
            <Button variant="outline" size="md" onClick={onSaveDraft} disabled={busy} data-testid="req-save">Save as draft</Button>
            {canSubmit && (
              <Button size="md" onClick={onSubmitClick} disabled={busy} data-testid="req-submit">Submit</Button>
            )}
          </div>
        )}
      </div>

      {banner && (
        <Alert tone="destructive" title={banner} className="mb-4" data-testid="req-banner" />
      )}

      {readOnly && (
        <Alert tone="info" title="This requisition has been submitted and can't be edited here." className="mb-4" data-testid="req-readonly-banner">
          <span className="text-[12.5px]">Status: {STATUS_LABEL[saved!.status]}.</span>
        </Alert>
      )}

      <Card className="flex flex-col gap-5 p-5">
        {readOnly ? (
          <ReadOnlyView requisition={saved!} items={new Map(items.map((i) => [i.id, i]))} projectName={projects.find((p) => p.id === saved!.projectId)?.name} />
        ) : (
          <>
            <RequisitionHeaderFields
              values={form}
              errors={fieldErrors}
              projects={projects}
              costCentres={costCentres}
              purposes={purposes}
              godowns={godowns}
              purposesLoading={purposesQuery.isLoading}
              onChange={patch}
              onAddPurpose={(name) =>
                createPurpose.mutate(
                  { projectId: form.projectId, name },
                  { onSuccess: (p) => patch({ purposeId: p.id }) },
                )
              }
            />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Requested items</h2>
              </div>
              <MaterialLinesGrid
                lines={form.lines}
                rates={rates}
                items={items}
                errors={lineErrors}
                onLineChange={changeLine}
                onAddLine={addLine}
                onRemoveLine={removeLine}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <EstimatedValueSummary estimatedValue={estimatedValue} estimating={estimating} budgetStatus={budget.data} />
            </div>
          </>
        )}
      </Card>

      {/* Mobile sticky bottom bar (site-facing) */}
      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 shadow-lg lg:hidden">
          <EstimatedValueSummary estimatedValue={estimatedValue} estimating={estimating} budgetStatus={budget.data} compact />
          <div className="flex gap-2">
            <Button variant="outline" size="md" onClick={onSaveDraft} disabled={busy} data-testid="req-save-mobile">Save</Button>
            {canSubmit && <Button size="md" onClick={onSubmitClick} disabled={busy} data-testid="req-submit-mobile">Submit</Button>}
          </div>
        </div>
      )}

      <Dialog open={submitOpen} onOpenChange={(o) => !o && setSubmitOpen(false)}>
        <DialogContent data-testid="req-submit-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogTitle>Submit this requisition?</DialogTitle>
          <DialogDescription className="mt-2">
            Once submitted, you can&apos;t edit it directly — you&apos;d need to return it to draft first, and only before it&apos;s approved.
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2.5">
            <Button variant="outline" size="md" onClick={() => setSubmitOpen(false)} disabled={busy} data-testid="req-submit-cancel">Keep editing</Button>
            <Button size="md" onClick={onSubmitConfirm} disabled={busy} aria-busy={busy || undefined} data-testid="req-submit-confirm">
              {busy ? "Selecting approval tier…" : "Submit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReadOnlyView({
  requisition,
  items,
  projectName,
}: {
  requisition: Requisition;
  items: Map<string, import("../types").ItemOption>;
  projectName: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 md:grid-cols-2">
        <Detail label="Project" value={projectName ?? requisition.projectId.slice(0, 8)} />
        <Detail label="Required date" value={formatDate(requisition.requiredDate)} />
        <Detail label="Priority" value={requisition.priority} />
        <Detail label="Estimated value" value={requisition.estimatedValue ? `৳ ${requisition.estimatedValue}` : "—"} />
        {requisition.narration && <Detail label="Narration" value={requisition.narration} wide />}
      </dl>
      <div>
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Requested items</h2>
        <RequisitionLinesReadOnly lines={requisition.lines ?? []} items={items} showIssued={requisition.status !== "SUBMITTED"} />
      </div>
    </div>
  );
}

function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : undefined}>
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[14px] text-foreground [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}
