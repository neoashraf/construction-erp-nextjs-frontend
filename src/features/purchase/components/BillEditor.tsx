"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { useOnline } from "@/lib/hooks/use-online";
import { asApiError } from "@/lib/api";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canPostBill, canWriteBill } from "../access";
import { usePurchaseBill } from "../hooks/useBill";
import { useBillMutations } from "../hooks/useBillMutations";
import { getPurchaseBill } from "../api/bills";
import {
  useCostCentreOptions,
  useCreatePurpose,
  useExpenseAccountOptions,
  useGodownOptions,
  useItemOptions,
  useProjectOptions,
  usePurposeOptions,
  useSupplierOptions,
} from "../hooks/usePoOptions";
import {
  billFormSchema,
  computeBillTotals,
  EMPTY_BILL_LINE,
  emptyBillForm,
  formToWriteInput,
  isEditableBill,
  isPostable,
  mapBillError,
  type BillFormValues,
  type BillLineError,
} from "../schemas/bill.schema";
import { BillHeaderFields } from "./BillHeaderFields";
import { BillLineGrid } from "./BillLineGrid";
import { BillTotalsStrip } from "./BillTotalsStrip";
import { BillStatusBadge } from "./BillStatusBadge";
import { PostDialog } from "./PostDialog";
import { BillDiscardDialog } from "./BillDiscardDialog";
import type { BudgetStatus, BudgetWarning, PurchaseBill } from "../types";

type FieldErrors = Partial<Record<keyof BillFormValues, string>>;

function isoToUi(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return formatDate(iso);
  } catch {
    return "";
  }
}

/**
 * Purchase Bill editor (brief §Scope 4-8, 12-17; spec §4/§6/§7; FR-PUR-003…-014, -024).
 * A blank DRAFT for `"new"`, else the loaded bill; only DRAFT is editable — POSTED /
 * CANCELLED render in the sibling viewer. The editor never asserts Σdr=Σcr — it guards
 * Post client-side on the postable-required fields, calls the atomic backend, and hands
 * off to the viewer on success. Cancel / Repost live on the viewer.
 */
export function BillEditor({ billId, onSaved }: { billId: string | null; onSaved?: (id: string) => void }) {
  const router = useRouter();
  const online = useOnline();
  const { toast } = useToast();
  const user = useAuthenticatedUser();
  const canWrite = canWriteBill(user);
  const canPost = canPostBill(user);

  const isNew = billId === null;
  const detail = usePurchaseBill(billId);
  const saved: PurchaseBill | undefined = detail.data;

  const [form, setForm] = useState<BillFormValues>(emptyBillForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [lineErrors, setLineErrors] = useState<BillLineError[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [postOpen, setPostOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<BudgetWarning[]>([]);
  const [autoPoLoad, setAutoPoLoad] = useState<string | null>(null);
  const lastPoLoadRef = useRef<string | null>(null);

  const { create, update, post } = useBillMutations();

  // Populate the form once the saved bill loads (edit / view).
  useEffect(() => {
    if (!saved) return;
    setForm({
      projectId: saved.projectId,
      supplierId: saved.supplierId,
      purchaseOrderId: saved.purchaseOrderId ?? "",
      supplierInvoiceRef: saved.supplierInvoiceRef ?? "",
      billDate: isoToUi(saved.billDate),
      dueDate: isoToUi(saved.dueDate),
      narration: saved.narration ?? "",
      lines: (saved.lines ?? []).map((l) => ({
        isStockLine: l.isStockLine,
        itemId: l.itemId ?? "",
        expenseAccountId: l.expenseAccountId ?? "",
        billedQty: l.billedQty ?? "",
        rate: l.rate ?? "",
        vatInputAmount: l.vatInputAmount ?? "0",
        tdsAmount: l.tdsAmount ?? "0",
        aitAmount: l.aitAmount ?? "0",
        godownId: l.godownId ?? "",
        costCentreId: l.costCentreId ?? "",
        purposeId: l.purposeId ?? "",
        receivedQty: l.receivedQty,
        matchStatus: l.matchStatus,
      })),
    });
  }, [saved]);

  const readOnly = !!saved && !isEditableBill(saved.status);
  const editable = !readOnly && canWrite;

  // Options.
  const projects = useProjectOptions().data ?? [];
  const suppliers = useSupplierOptions().data ?? [];
  const costCentres = useCostCentreOptions().data ?? [];
  const items = useItemOptions().data ?? [];
  const expenseAccounts = useExpenseAccountOptions().data ?? [];
  const purposesQuery = usePurposeOptions(form.projectId);
  const purposes = purposesQuery.data ?? [];
  const godowns = useGodownOptions(form.projectId || undefined).data ?? [];
  const createPurpose = useCreatePurpose();

  const totals = useMemo(() => computeBillTotals(form.lines), [form.lines]);

  // Per-line advisory budget mapping (FR-PUR-019 — never blocks Save/Post).
  const budgetByLine: Array<BudgetStatus | null> = useMemo(() => {
    if (warnings.length === 0) return form.lines.map(() => null);
    const key = (projectId: string, ccId: string) => `${projectId}::${ccId}`;
    const map = new Map(warnings.map((w) => [key(w.projectId, w.costCentreId), w.status]));
    return form.lines.map((l) => (l.costCentreId ? map.get(key(form.projectId, l.costCentreId)) ?? null : null));
  }, [warnings, form.lines, form.projectId]);

  function patch(p: Partial<BillFormValues>) {
    setForm((prev) => {
      const next = { ...prev, ...p };
      // Changing the project re-scopes godown + purpose (they're project-scoped).
      if (p.projectId !== undefined && p.projectId !== prev.projectId) {
        next.lines = prev.lines.map((l) => ({ ...l, godownId: "", purposeId: "" }));
      }
      // A change to supplier or project should also clear the "from PO" (must match both).
      if (
        (p.supplierId !== undefined && p.supplierId !== prev.supplierId) ||
        (p.projectId !== undefined && p.projectId !== prev.projectId)
      ) {
        next.purchaseOrderId = "";
      }
      return next;
    });
  }
  function changeLine(i: number, p: Partial<BillFormValues["lines"][number]>) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l, idx) => (idx === i ? { ...l, ...p } : l)),
    }));
  }
  function addLine() {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, { ...EMPTY_BILL_LINE }] }));
  }
  function removeLine(i: number) {
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, idx) => idx !== i) }));
  }

  // "From PO" defaulting — when the user picks a PO, fetch it and default lines from
  // its open lines (FR-PUR-003). Guarded against re-load on the same PO id.
  useEffect(() => {
    if (isNew && form.purchaseOrderId && form.purchaseOrderId !== lastPoLoadRef.current) {
      setAutoPoLoad(form.purchaseOrderId);
    }
    if (!form.purchaseOrderId) {
      lastPoLoadRef.current = null;
    }
  }, [form.purchaseOrderId, isNew]);

  useEffect(() => {
    if (!autoPoLoad) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { getPurchaseOrder } = await import("../api/orders");
        const po = await getPurchaseOrder(autoPoLoad);
        if (cancelled) return;
        // Only default lines when the PO matches the supplier/project (defence — the
        // server also enforces this, `PO_NOT_BILLABLE` surfaces inline otherwise).
        if (po.supplierId !== form.supplierId || po.projectId !== form.projectId) return;
        lastPoLoadRef.current = autoPoLoad;
        setForm((prev) => ({
          ...prev,
          lines: po.lines.map((l) => ({
            isStockLine: true,
            itemId: l.itemId,
            expenseAccountId: "",
            billedQty: l.orderedQty ?? "",
            rate: l.rate ?? "",
            vatInputAmount: "0",
            tdsAmount: "0",
            aitAmount: "0",
            godownId: l.godownId ?? "",
            costCentreId: l.costCentreId ?? "",
            purposeId: l.purposeId ?? "",
          })),
        }));
      } catch {
        // silent — server may reject with `PO_NOT_BILLABLE` on save.
      }
      if (!cancelled) setAutoPoLoad(null);
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPoLoad]);

  function validate(): BillFormValues | null {
    setBanner(null);
    // Field-level presence + tax non-negativity via zod.
    const result = billFormSchema.safeParse(form);
    const fe: FieldErrors = {};
    const le: BillLineError[] = form.lines.map(() => ({}));
    let bannerMsg: string | null = null;
    if (!result.success) {
      for (const issue of result.error.issues) {
        const [head, idx, leaf] = issue.path;
        if (head === "lines" && typeof idx === "number") {
          const key = String(leaf) as keyof BillLineError;
          le[idx] = { ...le[idx], [key]: issue.message };
        } else if (head === "lines" && idx === undefined) {
          bannerMsg = issue.message;
        } else if (typeof head === "string") {
          fe[head as keyof BillFormValues] = issue.message;
        }
      }
    }
    // Net-payable-negative → banner + block (FR-PUR-007, edge 11).
    if (totals.netPayableNegative) {
      bannerMsg =
        "TDS and AIT together are larger than the gross plus VAT input — net payable can't be negative. Reduce the withholding or increase the bill value.";
    }
    setFieldErrors(fe);
    setLineErrors(le);
    if (bannerMsg) setBanner(bannerMsg);
    if (!result.success) return null;
    if (totals.netPayableNegative) return null;
    return result.data;
  }

  function applyServerError(err: unknown) {
    const e = asApiError(err);
    const details = (e.details ?? {}) as { path?: string[] };
    const mapped = mapBillError(e.code, { path: details.path });
    if (mapped.field) {
      setFieldErrors((prev) => ({ ...prev, [mapped.field as keyof BillFormValues]: mapped.message }));
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

  async function persist(values: BillFormValues): Promise<{ id: string; version: number } | null> {
    const input = formToWriteInput(values);
    try {
      if (saved?.id) {
        const res = await update.mutateAsync({ id: saved.id, input: { ...input, version: saved.version } });
        setWarnings(res.warnings);
        return { id: res.bill.id, version: res.bill.version };
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
      setBanner("You're offline. Changes weren't saved.");
      return;
    }
    const values = validate();
    if (!values) return;
    setBusy(true);
    const res = await persist(values);
    setBusy(false);
    if (!res) return;
    toast("Purchase bill saved as draft.", "success");
    if (isNew) {
      onSaved?.(res.id);
      router.replace(`/purchase/bills/${res.id}`);
    }
  }

  function onPostClick() {
    if (!online) {
      setBanner("You're offline. Posting isn't available.");
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
    // Ensure server-side state matches the on-screen figures before we call /post.
    const res = await persist(values);
    if (!res) {
      setBusy(false);
      setPostOpen(false);
      return;
    }
    try {
      // Re-read the version to pass to /post — persist just refreshed it, but the
      // detail cache invalidates on success. Read from mutation result directly.
      const posted = await post.mutateAsync({ id: res.id, version: res.version });
      setBusy(false);
      setPostOpen(false);
      toast(`Purchase bill ${posted.entryNo} posted.`, "success");
      // Re-route to /bills/{id} — the page renders the viewer for POSTED bills.
      router.replace(`/purchase/bills/${posted.id}`);
    } catch (err) {
      setBusy(false);
      setPostOpen(false);
      applyServerError(err);
    }
  }

  // Preload the saved detail for the mutation's cache after any explicit save/post
  // — avoids a flash of the wrong status while the query invalidation propagates.
  useEffect(() => {
    if (!saved?.id) return;
    getPurchaseBill(saved.id).catch(() => {
      /* ignore — displayed error handled elsewhere */
    });
  }, [saved?.id]);

  // ── Render ──
  if (billId && detail.isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 mt-1 flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card className="flex flex-col gap-4 p-5" data-testid="bill-editor-loading">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
          <Skeleton className="h-48 w-full" />
        </Card>
      </div>
    );
  }

  if (billId && detail.isError) {
    const e = asApiError(detail.error);
    const msg =
      e.code === "FORBIDDEN"
        ? "You don't have access to this bill."
        : e.code === "NOT_FOUND"
          ? "This bill doesn't exist or isn't in your company."
          : "This bill could not be loaded.";
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb
          items={[
            { label: "Purchase" },
            { label: "Purchase bills", href: "/purchase/bills" },
            { label: "Bill" },
          ]}
        />
        <Alert tone="destructive" title={msg} className="mt-4" data-testid="bill-detail-error">
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => router.push("/purchase/bills")}>
              Back to bills
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
      <div className="mx-auto max-w-6xl">
        <Breadcrumb
          items={[
            { label: "Purchase" },
            { label: "Purchase bills", href: "/purchase/bills" },
            { label: "New" },
          ]}
        />
        <Alert
          tone="destructive"
          title="You don't have permission to raise a purchase bill."
          className="mt-4"
          data-testid="bill-403"
        />
      </div>
    );
  }

  const title = isNew ? "New purchase bill" : saved?.entryNo ?? "Purchase bill";
  const crumbTail = isNew ? "New" : saved?.entryNo ?? "Draft";
  const projectSelected = !!form.projectId;
  const postable = editable && canPost && isPostable(form, totals);

  return (
    <div className="mx-auto max-w-6xl pb-24 lg:pb-6">
      <Breadcrumb
        items={[
          { label: "Purchase" },
          { label: "Purchase bills", href: "/purchase/bills" },
          { label: crumbTail },
        ]}
      />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold tracking-[-0.02em]" data-testid="bill-form-title">
          {title}
        </h1>
        {saved && <BillStatusBadge status={saved.status} />}
        {editable && (
          <div className="ml-auto hidden gap-2 lg:flex">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setDiscardOpen(true)}
              disabled={busy}
              data-testid="bill-discard"
            >
              Discard
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={onSaveDraft}
              disabled={busy}
              data-testid="bill-save"
            >
              Save draft
            </Button>
            {canPost && (
              <Button
                size="md"
                onClick={onPostClick}
                disabled={busy || !postable}
                data-testid="bill-post"
              >
                Post
              </Button>
            )}
          </div>
        )}
      </div>

      {banner && (
        <Alert tone="destructive" title={banner} className="mb-4" data-testid="bill-banner" />
      )}

      {!online && (
        <Alert
          tone="warning"
          title="You're offline. Changes weren't saved."
          className="mb-4"
          data-testid="bill-offline"
        />
      )}

      <Card className="flex flex-col gap-5 p-5">
        <BillHeaderFields
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
              Bill lines
            </h2>
          </div>
          <BillLineGrid
            lines={form.lines}
            items={items}
            expenseAccounts={expenseAccounts}
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

        <BillTotalsStrip totals={totals} />
      </Card>

      {/* Mobile sticky bottom bar (back-office reference) */}
      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 shadow-lg lg:hidden">
          <span className="font-mono text-[13px] tabular-nums text-foreground">
            {totals.netPayable}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={onSaveDraft}
              disabled={busy}
              data-testid="bill-save-mobile"
            >
              Save
            </Button>
            {canPost && (
              <Button
                size="md"
                onClick={onPostClick}
                disabled={busy || !postable}
                data-testid="bill-post-mobile"
              >
                Post
              </Button>
            )}
          </div>
        </div>
      )}

      <PostDialog open={postOpen} busy={busy} onOpenChange={(o) => !o && setPostOpen(false)} onConfirm={onPostConfirm} />
      <BillDiscardDialog
        open={discardOpen}
        busy={busy}
        onOpenChange={(o) => !o && setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          router.push("/purchase/bills");
        }}
      />
    </div>
  );
}
