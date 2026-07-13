"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { canPostGrn, canWriteGrn } from "../access";
import { useGrn } from "../hooks/useGrn";
import { useGrnMutations } from "../hooks/useGrnMutations";
import { usePurchaseBills } from "../hooks/useBillList";
import {
  useCostCentreOptions,
  useCreatePurpose,
  useGodownOptions,
  useItemOptions,
  useProjectOptions,
  usePurposeOptions,
  useSupplierOptions,
} from "../hooks/usePoOptions";
import { getPurchaseOrder } from "../api/orders";
import { getPurchaseBill } from "../api/bills";
import {
  emptyGrnForm,
  formToWriteInput,
  grnFormSchema,
  isEditableGrn,
  isPostable,
  mapGrnError,
  type GrnFormValues,
  type GrnLineError,
} from "../schemas/grn.schema";
import { GrnHeaderFields, type GrnHeaderErrors } from "./GrnHeaderFields";
import { GrnLineGrid } from "./GrnLineGrid";
import { GrnStatusBadge } from "./GrnStatusBadge";
import { GrnPostDialog } from "./GrnPostDialog";
import { GrnDiscardDialog } from "./GrnDiscardDialog";
import type { Grn } from "../types";

function isoToUi(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return formatDate(iso);
  } catch {
    return "";
  }
}

/**
 * GRN entry screen (brief §Scope 3-6; spec §4/§6/§7; FR-PUR-015/-016/-017/-018/-024).
 * A blank DRAFT for `"new"`, else the loaded GRN; only DRAFT is editable. On Post
 * the atomic backend rolls INV `receiveIn` per line for the received qty (no ledger,
 * no PURCHASE number) and the screen switches to the read-only posted view with
 * a permanent "GRN posted — inventory updated." success banner. NO Cancel/Repost
 * affordance — correction is via the parent bill (SRS §16, open item 2).
 */
export function GrnEntry({ grnId, onSaved }: { grnId: string | null; onSaved?: (id: string) => void }) {
  const router = useRouter();
  const online = useOnline();
  const { toast } = useToast();
  const user = useAuthenticatedUser();
  const canWrite = canWriteGrn(user);
  const canPost = canPostGrn(user);

  const isNew = grnId === null;
  const detail = useGrn(grnId);
  const saved: Grn | undefined = detail.data;

  const [form, setForm] = useState<GrnFormValues>(() => {
    if (grnId) return emptyGrnForm;
    // Default receipt date = today (spec §7: "Defaults to today.").
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    return { ...emptyGrnForm, receiptDate: `${dd}/${mm}/${yyyy}` };
  });
  const [fieldErrors, setFieldErrors] = useState<GrnHeaderErrors>({});
  const [lineErrors, setLineErrors] = useState<GrnLineError[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [postOpen, setPostOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refBusy, setRefBusy] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const [postedBanner, setPostedBanner] = useState(false);
  const lastRefRef = useRef<string>("");

  const { create, update, post } = useGrnMutations();

  // Populate the form once the saved GRN loads.
  useEffect(() => {
    if (!saved) return;
    setForm({
      projectId: saved.projectId,
      supplierId: saved.supplierId,
      purchaseOrderId: saved.purchaseOrderId ?? "",
      purchaseBillId: saved.purchaseBillId ?? "",
      receiptDate: isoToUi(saved.receiptDate),
      narration: saved.narration ?? "",
      lines: saved.lines.map((l) => ({
        itemId: l.itemId,
        orderedQty: l.orderedQty ?? "",
        billedQty: l.billedQty ?? "",
        receivedQty: l.receivedQty ?? "",
        rate: l.rate ?? "",
        godownId: l.godownId ?? "",
        costCentreId: l.costCentreId ?? "",
        purposeId: l.purposeId ?? "",
        matchStatus: l.matchStatus,
      })),
    });
    lastRefRef.current = saved.purchaseOrderId ?? saved.purchaseBillId ?? "";
  }, [saved]);

  const readOnly = !!saved && !isEditableGrn(saved.status);
  const editable = !readOnly && canWrite;

  const projects = useProjectOptions().data ?? [];
  const suppliers = useSupplierOptions().data ?? [];
  const costCentres = useCostCentreOptions().data ?? [];
  const items = useItemOptions().data ?? [];
  const purposesQuery = usePurposeOptions(form.projectId);
  const purposes = purposesQuery.data ?? [];
  const godowns = useGodownOptions(form.projectId || undefined).data ?? [];
  const createPurpose = useCreatePurpose();
  const billsQuery = usePurchaseBills({ status: "POSTED", pageSize: 100 });
  const bills = billsQuery.data?.data ?? [];

  function patch(p: Partial<GrnFormValues>) {
    setForm((prev) => ({ ...prev, ...p }));
  }
  function changeLine(i: number, p: Partial<GrnFormValues["lines"][number]>) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l, idx) => (idx === i ? { ...l, ...p } : l)),
    }));
  }

  // ── PO / Bill reference → pre-fill lines from open quantities ────────────────
  useEffect(() => {
    if (!isNew) return;
    const ref = form.purchaseOrderId || form.purchaseBillId;
    if (!ref || ref === lastRefRef.current) return;
    let cancelled = false;
    setRefBusy(true);
    setRefError(null);
    lastRefRef.current = ref;
    (async () => {
      try {
        if (form.purchaseOrderId) {
          const po = await getPurchaseOrder(form.purchaseOrderId);
          if (cancelled) return;
          const openLines = po.lines.filter((l) => {
            const ordered = Number(l.orderedQty || "0");
            const received = Number(l.receivedQty || "0");
            return ordered - received > 0.0001;
          });
          setForm((prev) => ({
            ...prev,
            projectId: po.projectId,
            supplierId: po.supplierId,
            lines: openLines.map((l) => {
              const ordered = Number(l.orderedQty || "0");
              const received = Number(l.receivedQty || "0");
              const openQty = Math.max(ordered - received, 0);
              return {
                itemId: l.itemId,
                orderedQty: openQty.toFixed(4),
                billedQty: l.billedQty ?? "",
                receivedQty: openQty.toFixed(4),
                rate: l.rate ?? "",
                godownId: l.godownId ?? "",
                costCentreId: l.costCentreId ?? "",
                purposeId: l.purposeId ?? "",
              };
            }),
          }));
        } else if (form.purchaseBillId) {
          const bill = await getPurchaseBill(form.purchaseBillId);
          if (cancelled) return;
          const stockLines = bill.lines.filter((l) => l.isStockLine);
          setForm((prev) => ({
            ...prev,
            projectId: bill.projectId,
            supplierId: bill.supplierId,
            lines: stockLines.map((l) => {
              const billed = Number(l.billedQty || "0");
              const received = Number(l.receivedQty || "0");
              const openQty = Math.max(billed - received, 0);
              return {
                itemId: l.itemId ?? "",
                orderedQty: "",
                billedQty: openQty.toFixed(4),
                receivedQty: openQty.toFixed(4),
                rate: l.rate ?? "",
                godownId: l.godownId ?? "",
                costCentreId: l.costCentreId ?? "",
                purposeId: l.purposeId ?? "",
              };
            }),
          }));
        }
      } catch (err) {
        if (!cancelled) setRefError(asApiError(err).message || "Couldn't load this reference.");
      } finally {
        if (!cancelled) setRefBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.purchaseOrderId, form.purchaseBillId, isNew]);

  function validate(): GrnFormValues | null {
    setBanner(null);
    const result = grnFormSchema.safeParse(form);
    const fe: GrnHeaderErrors = {};
    const le: GrnLineError[] = form.lines.map(() => ({}));
    let bannerMsg: string | null = null;
    if (!result.success) {
      for (const issue of result.error.issues) {
        const [head, idx, leaf] = issue.path;
        if (head === "lines" && typeof idx === "number") {
          const key = String(leaf) as keyof GrnLineError;
          le[idx] = { ...le[idx], [key]: issue.message };
        } else if (head === "lines" && idx === undefined) {
          bannerMsg = issue.message;
        } else if (typeof head === "string") {
          fe[head as keyof GrnHeaderErrors] = issue.message;
        }
      }
    }
    if (!form.purchaseOrderId && !form.purchaseBillId) {
      fe.purchaseOrderId = "Choose a PO or Bill to receive against.";
    }
    setFieldErrors(fe);
    setLineErrors(le);
    if (bannerMsg) setBanner(bannerMsg);
    if (!result.success) return null;
    return result.data;
  }

  function applyServerError(err: unknown) {
    const e = asApiError(err);
    const details = (e.details ?? {}) as { path?: string[] };
    const mapped = mapGrnError(e.code, { path: details.path });
    if (mapped.field) {
      setFieldErrors((prev) => ({ ...prev, [mapped.field as keyof GrnHeaderErrors]: mapped.message }));
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

  async function persist(values: GrnFormValues): Promise<{ id: string; version: number } | null> {
    const input = formToWriteInput(values);
    try {
      if (saved?.id) {
        const res = await update.mutateAsync({ id: saved.id, input: { ...input, version: saved.version } });
        return { id: res.grn.id, version: res.grn.version };
      }
      const res = await create.mutateAsync(input);
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
    toast("GRN saved as draft.", "success");
    if (isNew) {
      onSaved?.(res.id);
      router.replace(`/purchase/grn/${res.id}`);
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
    const res = await persist(values);
    if (!res) {
      setBusy(false);
      setPostOpen(false);
      return;
    }
    try {
      const posted = await post.mutateAsync({ id: res.id, version: res.version });
      setBusy(false);
      setPostOpen(false);
      setPostedBanner(true);
      toast("GRN posted — inventory updated.", "success");
      router.replace(`/purchase/grn/${posted.id}`);
    } catch (err) {
      setBusy(false);
      setPostOpen(false);
      applyServerError(err);
    }
  }

  // ── Render ──
  if (grnId && detail.isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 mt-1 flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card className="flex flex-col gap-4 p-5" data-testid="grn-editor-loading">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    );
  }

  if (grnId && detail.isError) {
    const e = asApiError(detail.error);
    const msg =
      e.code === "FORBIDDEN"
        ? "You don't have access to this GRN."
        : e.code === "NOT_FOUND"
          ? "This GRN doesn't exist or isn't in your company."
          : "This GRN could not be loaded.";
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb
          items={[
            { label: "Purchase" },
            { label: "Goods receipt", href: "/purchase/grn" },
            { label: "GRN" },
          ]}
        />
        <Alert tone="destructive" title={msg} className="mt-4" data-testid="grn-detail-error">
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => router.push("/purchase/grn")}>
              Back to GRNs
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
            { label: "Goods receipt", href: "/purchase/grn" },
            { label: "New" },
          ]}
        />
        <Alert
          tone="destructive"
          title="You don't have permission to record a goods receipt."
          className="mt-4"
          data-testid="grn-403"
        />
      </div>
    );
  }

  const title = isNew ? "New goods receipt" : saved?.grnRefNo ?? "Goods receipt";
  const crumbTail = isNew ? "New GRN" : saved?.grnRefNo ?? "Draft";
  const projectSelected = !!form.projectId;
  const postable = editable && canPost && isPostable(form);

  return (
    <div className="mx-auto max-w-6xl pb-24 lg:pb-6">
      <Breadcrumb
        items={[
          { label: "Purchase" },
          { label: "Goods receipt", href: "/purchase/grn" },
          { label: crumbTail },
        ]}
      />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold tracking-[-0.02em]" data-testid="grn-form-title">
          {title}
        </h1>
        {saved ? (
          <GrnStatusBadge status={saved.status} />
        ) : (
          <GrnStatusBadge status="DRAFT" />
        )}
        {editable && (
          <div className="ml-auto hidden gap-2 lg:flex">
            <Button variant="ghost" size="md" asChild data-testid="grn-back">
              <Link href="/purchase/grn">Back</Link>
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={onSaveDraft}
              disabled={busy || refBusy}
              data-testid="grn-save"
            >
              Save draft
            </Button>
            {canPost && (
              <Button
                size="md"
                onClick={onPostClick}
                disabled={busy || refBusy || !postable}
                aria-busy={busy || undefined}
                data-testid="grn-post"
              >
                {busy ? "Posting…" : "Post"}
              </Button>
            )}
          </div>
        )}
      </div>

      {readOnly && postedBanner && (
        <Alert
          tone="success"
          title="GRN posted — inventory updated."
          className="mb-4"
          data-testid="grn-posted-banner"
        >
          Stock now reflects the quantity actually received. Corrections are a new GRN
          or a reversal via the parent bill.
        </Alert>
      )}

      {banner && (
        <Alert tone="destructive" title={banner} className="mb-4" data-testid="grn-banner" />
      )}

      {refError && (
        <Alert tone="destructive" title="Couldn't load this reference." className="mb-4" data-testid="grn-ref-error">
          {refError}
        </Alert>
      )}

      {!online && (
        <Alert
          tone="warning"
          title="You're offline. Changes weren't saved."
          className="mb-4"
          data-testid="grn-offline"
        >
          Received-qty entries are kept locally; resubmit once you reconnect.
        </Alert>
      )}

      <Card className="flex flex-col gap-5 p-5">
        <GrnHeaderFields
          values={form}
          errors={fieldErrors}
          disabled={readOnly || refBusy}
          projects={projects}
          suppliers={suppliers}
          bills={bills}
          onChange={patch}
        />

        {refBusy ? (
          <div className="flex flex-col gap-2" data-testid="grn-ref-loading">
            <Skeleton className="h-6 w-40" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <GrnLineGrid
            lines={form.lines}
            items={items}
            costCentres={costCentres}
            purposes={purposes}
            godowns={godowns}
            purposesLoading={purposesQuery.isLoading}
            errors={lineErrors}
            disabled={readOnly || busy}
            projectSelected={projectSelected}
            onLineChange={changeLine}
            onAddPurpose={(name) =>
              createPurpose.mutate({ projectId: form.projectId, name })
            }
          />
        )}

        {readOnly && saved?.postedAt && (
          <div
            className="rounded-card border border-border bg-surface-2 px-4 py-3 text-[12.5px] text-muted-foreground"
            data-testid="grn-posted-meta"
          >
            Posted <span className="font-semibold text-foreground">{formatDate(saved.postedAt)}</span>
            {saved.receivedBy ? (
              <> by <span className="font-semibold text-foreground">{saved.receivedBy}</span></>
            ) : null}.
          </div>
        )}
      </Card>

      {/* Mobile sticky bottom bar — the warehouse-floor Post action. */}
      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 shadow-lg lg:hidden">
          <Button
            variant="outline"
            size="md"
            onClick={onSaveDraft}
            disabled={busy || refBusy}
            data-testid="grn-save-mobile"
          >
            Draft
          </Button>
          {canPost && (
            <Button
              size="md"
              className="flex-1"
              onClick={onPostClick}
              disabled={busy || refBusy || !postable}
              aria-busy={busy || undefined}
              data-testid="grn-post-mobile"
            >
              {busy ? "Posting…" : "Post goods receipt"}
            </Button>
          )}
        </div>
      )}

      <GrnPostDialog open={postOpen} busy={busy} onOpenChange={(o) => !o && setPostOpen(false)} onConfirm={onPostConfirm} />
      <GrnDiscardDialog
        open={discardOpen}
        busy={busy}
        onOpenChange={(o) => !o && setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          router.push("/purchase/grn");
        }}
      />
    </div>
  );
}
