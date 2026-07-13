"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { formatMoney, toDecimal } from "@/lib/money";
import { useOnline } from "@/lib/hooks/use-online";
import { asApiError } from "@/lib/api";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canApprovePo, canCancelPo, canWritePo } from "../access";
import { usePurchaseOrder } from "../hooks/usePo";
import { usePoMutations } from "../hooks/usePoMutations";
import {
  useCostCentreOptions,
  useCreatePurpose,
  useGodownOptions,
  useItemOptions,
  useProjectOptions,
  usePurposeOptions,
  useSupplierOptions,
} from "../hooks/usePoOptions";
import {
  EMPTY_PO_LINE,
  emptyPoForm,
  formToWriteInput,
  isCancellablePo,
  isEditablePo,
  mapPoError,
  poFormSchema,
  PO_STATUS_LABEL,
  type PoFormValues,
  type PoLineError,
} from "../schemas/order.schema";
import { PoHeaderFields } from "./PoHeaderFields";
import { PoLineGrid } from "./PoLineGrid";
import { PurchaseStatusBadge } from "./PurchaseStatusBadge";
import { ApproveDialog } from "./ApproveDialog";
import { CancelPoDialog } from "./CancelPoDialog";
import type { BudgetStatus, BudgetWarning, PurchaseOrder } from "../types";

type FieldErrors = Partial<Record<keyof PoFormValues, string>>;

function isoToUi(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return formatDate(iso);
  } catch {
    return "";
  }
}

/**
 * Purchase Order editor / read-only viewer (brief §Scope 4-13; spec §4/§6; FR-PUR-001…-024).
 * A blank DRAFT for `"new"`, else the loaded PO — editable only while DRAFT, otherwise
 * fully read-only with a status banner. No optimistic status flip on Approve; Cancel
 * requires a mandatory reason; advisory budget badges NEVER block Save/Approve. Full state
 * matrix (loading · error+retry · saving/approving · offline · permission-denied).
 */
export function PoEditor({ poId }: { poId: string | null }) {
  const router = useRouter();
  const online = useOnline();
  const { toast } = useToast();
  const user = useAuthenticatedUser();
  const canWrite = canWritePo(user);
  const canApprove = canApprovePo(user);
  const canCancel = canCancelPo(user);

  const isNew = poId === null;
  const detail = usePurchaseOrder(poId);
  const saved: PurchaseOrder | undefined = detail.data;

  const [form, setForm] = useState<PoFormValues>(emptyPoForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [lineErrors, setLineErrors] = useState<PoLineError[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<BudgetWarning[]>([]);

  const { create, update, approve, cancel } = usePoMutations();

  // Populate the form once the saved PO loads (edit / view).
  useEffect(() => {
    if (!saved) return;
    setForm({
      projectId: saved.projectId,
      supplierId: saved.supplierId,
      poDate: isoToUi(saved.poDate),
      expectedDeliveryDate: isoToUi(saved.expectedDeliveryDate),
      narration: saved.narration ?? "",
      lines: (saved.lines ?? []).map((l) => ({
        itemId: l.itemId,
        orderedQty: l.orderedQty,
        rate: l.rate,
        godownId: l.godownId,
        costCentreId: l.costCentreId,
        purposeId: l.purposeId,
      })),
    });
  }, [saved]);

  const readOnly = !!saved && !isEditablePo(saved.status);
  const editable = !readOnly && canWrite;

  // Options.
  const projects = useProjectOptions().data ?? [];
  const suppliers = useSupplierOptions().data ?? [];
  const costCentres = useCostCentreOptions().data ?? [];
  const items = useItemOptions().data ?? [];
  const purposesQuery = usePurposeOptions(form.projectId);
  const purposes = purposesQuery.data ?? [];
  const godowns = useGodownOptions(form.projectId || undefined).data ?? [];
  const createPurpose = useCreatePurpose();

  // Per-(project, costCentre) budget → per-line badge mapping. Warnings come from the
  // last create/patch response — they are advisory and non-blocking (FR-PUR-019).
  const budgetByLine: Array<BudgetStatus | null> = useMemo(() => {
    if (warnings.length === 0) return form.lines.map(() => null);
    const key = (projectId: string, ccId: string) => `${projectId}::${ccId}`;
    const map = new Map(warnings.map((w) => [key(w.projectId, w.costCentreId), w.status]));
    return form.lines.map((l) => (l.costCentreId ? map.get(key(form.projectId, l.costCentreId)) ?? null : null));
  }, [warnings, form.lines, form.projectId]);

  // Derived: totals strip (informational).
  const totalAmount = useMemo(() => {
    let sum = toDecimal("0");
    for (const l of form.lines) {
      if (!l.orderedQty || !l.rate) continue;
      const q = Number(l.orderedQty);
      const r = Number(l.rate);
      if (!(q > 0) || !(r >= 0)) continue;
      sum = sum.plus(toDecimal(l.orderedQty).times(toDecimal(l.rate)));
    }
    return sum.toFixed(4);
  }, [form.lines]);

  function patch(p: Partial<PoFormValues>) {
    setForm((prev) => {
      const next = { ...prev, ...p };
      // Changing the project re-scopes godown + purpose (they're project-scoped).
      if (p.projectId !== undefined && p.projectId !== prev.projectId) {
        next.lines = prev.lines.map((l) => ({ ...l, godownId: "", purposeId: "" }));
      }
      return next;
    });
  }
  function changeLine(i: number, p: Partial<PoFormValues["lines"][number]>) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l, idx) => (idx === i ? { ...l, ...p } : l)),
    }));
  }
  function addLine() {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, { ...EMPTY_PO_LINE }] }));
  }
  function removeLine(i: number) {
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, idx) => idx !== i) }));
  }

  function validate(): PoFormValues | null {
    const result = poFormSchema.safeParse(form);
    if (result.success) {
      setFieldErrors({});
      setLineErrors([]);
      return result.data;
    }
    const fe: FieldErrors = {};
    const le: PoLineError[] = form.lines.map(() => ({}));
    let linesLevelBanner: string | null = null;
    for (const issue of result.error.issues) {
      const [head, idx, leaf] = issue.path;
      if (head === "lines" && typeof idx === "number") {
        const key = String(leaf) as keyof PoLineError;
        le[idx] = { ...le[idx], [key]: issue.message };
      } else if (head === "lines" && idx === undefined) {
        linesLevelBanner = issue.message;
      } else if (typeof head === "string") {
        fe[head as keyof PoFormValues] = issue.message;
      }
    }
    setFieldErrors(fe);
    setLineErrors(le);
    if (linesLevelBanner) setBanner(linesLevelBanner);
    return null;
  }

  function applyServerError(err: unknown) {
    const e = asApiError(err);
    const details = (e.details ?? {}) as { path?: string[] };
    const mapped = mapPoError(e.code, { path: details.path });
    if (mapped.field) {
      setFieldErrors((prev) => ({ ...prev, [mapped.field as keyof PoFormValues]: mapped.message }));
    }
    if (mapped.lineField && mapped.lineIndex != null) {
      setLineErrors((prev) => {
        const next = [...prev];
        while (next.length <= mapped.lineIndex!) next.push({});
        next[mapped.lineIndex!] = { ...next[mapped.lineIndex!], [mapped.lineField!]: mapped.message };
        return next;
      });
    }
    setBanner(mapped.message);
  }

  async function persist(values: PoFormValues): Promise<{ id: string; version: number } | null> {
    const input = formToWriteInput(values);
    try {
      if (saved?.id) {
        const res = await update.mutateAsync({ id: saved.id, input: { ...input, version: saved.version } });
        setWarnings(res.warnings);
        return { id: res.order.id, version: res.order.version };
      }
      const res = await create.mutateAsync(input);
      setWarnings(res.warnings);
      return { id: res.id, version: 1 };
    } catch (err) {
      applyServerError(err);
      return null;
    }
  }

  async function onSaveDraft() {
    if (!online) {
      setBanner("You're offline. Your purchase order wasn't saved.");
      return;
    }
    setBanner(null);
    const values = validate();
    if (!values) return;
    setBusy(true);
    const res = await persist(values);
    setBusy(false);
    if (!res) return;
    toast("Purchase order saved as draft.", "success");
    if (isNew) router.replace(`/purchase/orders/${res.id}`);
  }

  function onApproveClick() {
    if (!online) {
      setBanner("You're offline. Approval isn't available.");
      return;
    }
    setBanner(null);
    if (!validate()) return;
    setApproveOpen(true);
  }

  async function onApproveConfirm() {
    const values = validate();
    if (!values) {
      setApproveOpen(false);
      return;
    }
    setBusy(true);
    const res = await persist(values);
    if (!res) {
      setBusy(false);
      setApproveOpen(false);
      return;
    }
    try {
      const approved = await approve.mutateAsync({ id: res.id, version: res.version });
      setBusy(false);
      setApproveOpen(false);
      const label = approved.id === saved?.id && saved?.poRefNo ? saved.poRefNo : res.id.slice(0, 8);
      toast(`Purchase order ${label} approved.`, "success");
      // The detail query invalidation refreshes the badge + read-only view.
    } catch (err) {
      setBusy(false);
      setApproveOpen(false);
      applyServerError(err);
    }
  }

  async function onCancelConfirm(reason: string) {
    if (!saved) {
      setCancelOpen(false);
      return;
    }
    if (!online) {
      setCancelOpen(false);
      setBanner("You're offline. Cancellation isn't available.");
      return;
    }
    setBusy(true);
    try {
      await cancel.mutateAsync({ id: saved.id, reason, version: saved.version });
      setBusy(false);
      setCancelOpen(false);
      toast("Purchase order cancelled.", "success");
    } catch (err) {
      setBusy(false);
      setCancelOpen(false);
      applyServerError(err);
    }
  }

  // ── Render ──
  if (poId && detail.isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 mt-1 flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card className="flex flex-col gap-4 p-5" data-testid="po-editor-loading">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    );
  }

  if (poId && detail.isError) {
    const e = asApiError(detail.error);
    const msg =
      e.code === "FORBIDDEN"
        ? "You don't have access to this purchase order."
        : e.code === "NOT_FOUND"
          ? "This purchase order could not be found."
          : "This purchase order could not be loaded.";
    return (
      <div className="mx-auto max-w-5xl">
        <Breadcrumb items={[{ label: "Purchase" }, { label: "Purchase orders", href: "/purchase/orders" }, { label: "Purchase order" }]} />
        <Alert tone="destructive" title={msg} className="mt-4" data-testid="po-detail-error">
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => router.push("/purchase/orders")}>
              Back to purchase orders
            </Button>
            <Button size="sm" onClick={() => detail.refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (isNew && !canWrite) {
    return (
      <div className="mx-auto max-w-5xl">
        <Breadcrumb items={[{ label: "Purchase" }, { label: "Purchase orders", href: "/purchase/orders" }, { label: "New" }]} />
        <Alert
          tone="destructive"
          title="You don't have permission to raise a purchase order."
          className="mt-4"
          data-testid="po-403"
        />
      </div>
    );
  }

  const title = isNew
    ? "New purchase order"
    : readOnly
      ? saved?.poRefNo ?? "Purchase order"
      : "Edit purchase order";
  const crumbTail = isNew ? "New" : saved?.poRefNo ?? "Draft";
  const projectSelected = !!form.projectId;

  return (
    <div className="mx-auto max-w-5xl pb-24 lg:pb-6">
      <Breadcrumb
        items={[
          { label: "Purchase" },
          { label: "Purchase orders", href: "/purchase/orders" },
          { label: crumbTail },
        ]}
      />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold tracking-[-0.02em]" data-testid="po-form-title">
          {title}
        </h1>
        {saved && <PurchaseStatusBadge status={saved.status} />}
        {editable && (
          <div className="ml-auto hidden gap-2 lg:flex">
            <Button
              variant="outline"
              size="md"
              onClick={onSaveDraft}
              disabled={busy}
              data-testid="po-save"
            >
              Save as draft
            </Button>
            {canApprove && (
              <Button size="md" onClick={onApproveClick} disabled={busy} data-testid="po-approve">
                Approve
              </Button>
            )}
            {saved && isCancellablePo(saved.status) && canCancel && (
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setBanner(null);
                  setCancelOpen(true);
                }}
                disabled={busy}
                data-testid="po-cancel"
              >
                Cancel PO
              </Button>
            )}
          </div>
        )}
        {readOnly && saved && isCancellablePo(saved.status) && canCancel && (
          <Button
            variant="outline"
            size="md"
            className="ml-auto"
            onClick={() => {
              setBanner(null);
              setCancelOpen(true);
            }}
            disabled={busy}
            data-testid="po-cancel"
          >
            Cancel PO
          </Button>
        )}
      </div>

      {banner && (
        <Alert tone="destructive" title={banner} className="mb-4" data-testid="po-banner" />
      )}

      {readOnly && saved && (
        <Alert
          tone="info"
          title={`This purchase order is ${PO_STATUS_LABEL[saved.status]} and can't be edited here.`}
          className="mb-4"
          data-testid="po-readonly-banner"
        >
          <span className="text-[12.5px]">
            {saved.approvedAt && `Approved on ${formatDate(saved.approvedAt.slice(0, 10))}. `}
            {`PO ref: ${saved.poRefNo ?? "(pending)"}.`}
          </span>
        </Alert>
      )}

      <Card className="flex flex-col gap-5 p-5">
        <PoHeaderFields
          values={form}
          errors={fieldErrors}
          disabled={readOnly}
          projects={projects}
          suppliers={suppliers}
          onChange={patch}
        />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              Order lines
            </h2>
            <span className="font-mono text-[13px] tabular-nums text-muted-foreground" data-testid="po-total">
              Total {formatMoney(totalAmount)}
            </span>
          </div>
          <PoLineGrid
            lines={form.lines}
            items={items}
            costCentres={costCentres}
            purposes={purposes}
            godowns={godowns}
            purposesLoading={purposesQuery.isLoading}
            budgetByLine={budgetByLine}
            errors={lineErrors}
            disabled={readOnly}
            projectSelected={projectSelected}
            onLineChange={changeLine}
            onAddLine={addLine}
            onRemoveLine={removeLine}
            onAddPurpose={(name) =>
              createPurpose.mutate(
                { projectId: form.projectId, name },
                {
                  onSuccess: () => {
                    // Refresh happens via query invalidation; user re-picks the new option.
                  },
                },
              )
            }
          />
        </div>

        {saved && (
          <ReadOnlyMeta saved={saved} />
        )}
      </Card>

      {/* Mobile sticky bottom bar */}
      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 shadow-lg lg:hidden">
          <span className="font-mono text-[13px] tabular-nums text-foreground">
            {formatMoney(totalAmount)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={onSaveDraft}
              disabled={busy}
              data-testid="po-save-mobile"
            >
              Save
            </Button>
            {canApprove && (
              <Button
                size="md"
                onClick={onApproveClick}
                disabled={busy}
                data-testid="po-approve-mobile"
              >
                Approve
              </Button>
            )}
          </div>
        </div>
      )}

      <ApproveDialog
        open={approveOpen}
        busy={busy}
        onOpenChange={(o) => !o && setApproveOpen(false)}
        onConfirm={onApproveConfirm}
      />
      <CancelPoDialog
        open={cancelOpen}
        busy={busy}
        onOpenChange={(o) => !o && setCancelOpen(false)}
        onConfirm={onCancelConfirm}
      />
    </div>
  );
}

function ReadOnlyMeta({ saved }: { saved: PurchaseOrder }) {
  const totalBilled = saved.lines.reduce(
    (acc, l) => acc.plus(toDecimal(l.billedQty ?? "0")),
    toDecimal("0"),
  );
  const totalReceived = saved.lines.reduce(
    (acc, l) => acc.plus(toDecimal(l.receivedQty ?? "0")),
    toDecimal("0"),
  );
  if (totalBilled.eq(0) && totalReceived.eq(0)) return null;
  return (
    <div className="grid gap-3 border-t border-border pt-4 text-[12.5px] md:grid-cols-3">
      <Meta label="Total billed" value={totalBilled.toFixed(3)} />
      <Meta label="Total received" value={totalReceived.toFixed(3)} />
      <Meta
        label="Expected delivery"
        value={saved.expectedDeliveryDate ? formatDate(saved.expectedDeliveryDate) : "—"}
      />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-mono tabular-nums text-foreground">{value}</div>
    </div>
  );
}

