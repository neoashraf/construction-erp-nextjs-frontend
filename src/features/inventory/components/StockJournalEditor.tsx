"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { toDecimal, formatQty } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { asApiError } from "@/lib/api/errors";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canApprove, canOverrideNegativeStock, canPost, canReverse, canWriteDraft } from "../access";
import { useStockJournal } from "../hooks/useStockJournals";
import { useStockJournalMutations } from "../hooks/useStockJournalMutations";
import {
  useCostCentreOptions,
  useGodownOptions,
  useItemOptions,
  useOnHand,
  useProjectOptions,
  usePurposeOptions,
  useUserOptions,
} from "../hooks/useInventoryOptions";
import { ModeSelector } from "./ModeSelector";
import { OnHandBadge } from "./OnHandBadge";
import { SideDimensionBlock, type SideField } from "./SideDimensionBlock";
import { StatusBadge } from "./StatusBadge";
import { NegativeStockDialog } from "./NegativeStockDialog";
import { ReverseDialog } from "./ReverseDialog";
import { useOnline } from "@/lib/hooks/use-online";
import {
  emptyStockJournalForm,
  formToWriteInput,
  mapStockJournalError,
  stockJournalSchema,
  type StockJournalFormValues,
} from "../schemas/stock-journal.schema";
import { type StockJournal, type StockJournalMode } from "../types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Seed the form from a loaded journal (prefer its per-side `lines[]`, fall back to header). */
function journalToForm(sj: StockJournal): StockJournalFormValues {
  const out = sj.lines?.find((l) => l.side === "OUT");
  const inn = sj.lines?.find((l) => l.side === "IN");
  return {
    mode: sj.mode,
    voucherDate: sj.voucherDate,
    itemId: sj.itemId,
    quantity: sj.quantity,
    issuedById: sj.issuedById ?? "",
    receivedById: sj.receivedById ?? "",
    narration: sj.narration ?? "",
    outGodownId: out?.godownId ?? sj.fromGodownId ?? "",
    outProjectId: out?.projectId ?? sj.projectId ?? "",
    outCostCentreId: out?.costCentreId ?? sj.costCentreId ?? "",
    outPurposeId: out?.purposeId ?? sj.purposeId ?? "",
    inGodownId: inn?.godownId ?? sj.toGodownId ?? "",
    inProjectId: inn?.projectId ?? "",
    inCostCentreId: inn?.costCentreId ?? "",
    inPurposeId: inn?.purposeId ?? "",
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Stock Journal editor / viewer (spec §4.B/§7/§9; FR-INV-007…-022). Captures a DRAFT in
 * TRANSFER / ISSUE / ADJUSTMENT mode with four dimensions per side, drives the
 * draft→approve→post→reverse lifecycle (each server-confirmed, no optimistic flip), and
 * renders fully read-only once past DRAFT. Rate/value are the server-computed estimate
 * (FR-INV-003). Full state matrix (spec §6). Write actions are hidden (not disabled) for
 * actors lacking scope; the server re-checks regardless.
 */
export function StockJournalEditor({ id }: { id: string }) {
  const isNew = id === "new";
  const user = useAuthenticatedUser();
  const online = useOnline();
  const router = useRouter();
  const { toast } = useToast();
  const m = useStockJournalMutations();

  const detail = useStockJournal(isNew ? null : id);
  const journal = detail.data;
  const status = journal?.status ?? "DRAFT";
  const version = journal?.version ?? 0;
  const editable = (isNew || status === "DRAFT") && canWriteDraft(user);

  const [form, setForm] = useState<StockJournalFormValues>(() => emptyStockJournalForm("TRANSFER", todayIso()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [showNegative, setShowNegative] = useState(false);
  const [showReverse, setShowReverse] = useState(false);
  const [negError, setNegError] = useState<string | null>(null);
  const [reverseError, setReverseError] = useState<string | null>(null);

  // Seed from the loaded journal (and re-seed after a version-changing mutation).
  useEffect(() => {
    if (journal) setForm(journalToForm(journal));
  }, [journal?.id, journal?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Options.
  const projectsQuery = useProjectOptions();
  const costCentresQuery = useCostCentreOptions();
  const itemsQuery = useItemOptions();
  const usersQuery = useUserOptions();
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const costCentres = useMemo(() => costCentresQuery.data ?? [], [costCentresQuery.data]);
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const outGodowns = useGodownOptions(form.outProjectId || undefined).data ?? [];
  const inGodowns = useGodownOptions(form.inProjectId || undefined).data ?? [];
  const outPurposes = usePurposeOptions(form.outProjectId).data ?? [];
  const inPurposes = usePurposeOptions(form.inProjectId).data ?? [];

  const item = items.find((i) => i.id === form.itemId);
  const uom = item?.uom ?? "unit";
  const outGodownName = outGodowns.find((g) => g.id === form.outGodownId)?.name ?? "";

  // On-hand for the OUT (source) side.
  const onHand = useOnHand(form.outGodownId, form.itemId);
  const onHandQty = onHand.data?.quantityOnHand ?? null;
  const negativeWarning = !!form.quantity && onHandQty !== null && Number(form.quantity) > Number(onHandQty);

  // Rate/value estimate from the source godown's current weighted average (finalised at post).
  const rateEstimate = onHand.data?.weightedAverageRate ?? null;
  const valueEstimate =
    rateEstimate && form.quantity && Number(form.quantity) > 0
      ? toDecimal(rateEstimate).mul(toDecimal(form.quantity)).toFixed(4)
      : null;

  function setSide(prefix: "out" | "in", field: SideField, val: string) {
    setForm((f) => {
      const patch: Record<string, string> = { [`${prefix}${cap(field)}`]: val };
      if (field === "projectId") {
        // Godown + purpose are project-scoped — clear them when the side's project changes.
        patch[`${prefix}GodownId`] = "";
        patch[`${prefix}PurposeId`] = "";
      }
      return { ...f, ...patch };
    });
  }

  function validate(): StockJournalFormValues | null {
    const parsed = stockJournalSchema.safeParse(form);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!map[key]) map[key] = issue.message;
      }
      setErrors(map);
      return null;
    }
    setErrors({});
    return parsed.data;
  }

  function handleSave() {
    setActionError(null);
    const valid = validate();
    if (!valid) return;
    const input = formToWriteInput(valid);
    if (isNew) {
      m.create.mutate(input, {
        onSuccess: (sj) => {
          toast("Stock Journal saved as draft.", "success");
          router.replace(`/inventory/stock-journals/${sj.id}`);
        },
        onError: (e) => onWriteError(e),
      });
    } else {
      m.update.mutate(
        { id, input: { ...input, version } },
        { onSuccess: () => toast("Stock Journal saved as draft.", "success"), onError: (e) => onWriteError(e) },
      );
    }
  }

  function onWriteError(e: unknown) {
    const err = asApiError(e);
    if (err.code === "SAME_GODOWN_TRANSFER") {
      setErrors((prev) => ({ ...prev, inGodownId: "Source and destination can't be the same godown." }));
      return;
    }
    setActionError(mapStockJournalError(err.code));
  }

  function handleApprove() {
    setActionError(null);
    m.approve.mutate(
      { id, version },
      {
        onSuccess: () => toast("Stock Journal approved.", "success"),
        onError: (e) => setActionError(mapStockJournalError(asApiError(e).code)),
      },
    );
  }

  function runPost(allow?: { reason: string }) {
    setNegError(null);
    setActionError(null);
    m.post.mutate(
      { id, input: { version, allowNegativeStock: !!allow, negativeStockReason: allow?.reason } },
      {
        onSuccess: (sj) => {
          setShowNegative(false);
          toast(
            sj.entryNo
              ? `Stock Journal posted. Entry no ${sj.entryNo}.`
              : "Stock Journal posted. No ledger entry (value-neutral transfer).",
            "success",
          );
        },
        onError: (e) => {
          const msg = mapStockJournalError(asApiError(e).code, { itemName: item?.name, godownName: outGodownName });
          if (showNegative) setNegError(msg);
          else setActionError(msg);
        },
      },
    );
  }

  function handlePostClick() {
    if (negativeWarning && canOverrideNegativeStock(user)) {
      setShowNegative(true);
      return;
    }
    runPost();
  }

  function handleReverse(reason: string) {
    setReverseError(null);
    m.reverse.mutate(
      { id, reason, version },
      {
        onSuccess: () => {
          setShowReverse(false);
          toast("Stock Journal reversed.", "success");
        },
        onError: (e) => setReverseError(mapStockJournalError(asApiError(e).code)),
      },
    );
  }

  function handleDelete() {
    m.remove.mutate(
      { id, version },
      {
        onSuccess: () => {
          toast("Draft deleted.", "success");
          router.push("/inventory/stock-journals");
        },
        onError: (e) => setActionError(mapStockJournalError(asApiError(e).code)),
      },
    );
  }

  // ---- render ----
  if (!isNew && detail.isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <Skeleton className="mb-4 h-8 w-64" />
        <Card className="mb-4 p-6">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!isNew && detail.isError) {
    const err = asApiError(detail.error);
    const forbidden = err.code === "FORBIDDEN" || err.status === 403;
    return (
      <div className="mx-auto max-w-5xl">
        <Breadcrumb items={[{ label: "Stock Journal", href: "/inventory/stock-journals" }, { label: "Not available" }]} />
        <div className="mt-8" data-testid="sj-editor-error">
          <EmptyState
            icon={AlertTriangle}
            title={forbidden ? "You don't have access to this Stock Journal." : "Couldn't load this Stock Journal."}
            description={forbidden ? "It may belong to a project you're not assigned to." : "Check your connection and try again."}
            action={
              !forbidden ? (
                <Button size="md" onClick={() => detail.refetch()} data-testid="sj-editor-retry">
                  Retry
                </Button>
              ) : (
                <Button size="md" variant="outline" asChild>
                  <Link href="/inventory/stock-journals">Back to list</Link>
                </Button>
              )
            }
          />
        </div>
      </div>
    );
  }

  const title = isNew
    ? "New Stock Journal"
    : journal?.entryNo
      ? `Stock Journal ${journal.entryNo}`
      : "Stock Journal (draft)";
  const busy = m.create.isPending || m.update.isPending || m.approve.isPending || m.post.isPending || m.reverse.isPending || m.remove.isPending;

  return (
    <div className="mx-auto max-w-5xl">
      <Breadcrumb
        items={[
          { label: "Stock Journal", href: "/inventory/stock-journals" },
          { label: isNew ? "New" : (journal?.entryNo ?? "Draft") },
        ]}
      />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="sj-editor-title">
          {title}
        </h1>
        <StatusBadge status={status} />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="md" asChild data-testid="sj-back">
            <Link href="/inventory/stock-journals">Back to list</Link>
          </Button>
          {editable && (
            <Button size="md" variant="outline" onClick={handleSave} disabled={busy || !online} data-testid="sj-save">
              {m.create.isPending || m.update.isPending ? "Saving…" : "Save draft"}
            </Button>
          )}
          {!isNew && status === "DRAFT" && canApprove(user) && (
            <Button size="md" onClick={handleApprove} disabled={busy || !online} aria-busy={m.approve.isPending || undefined} data-testid="sj-approve">
              {m.approve.isPending ? "Approving…" : "Approve"}
            </Button>
          )}
          {status === "APPROVED" && canPost(user) && (
            <Button size="md" onClick={handlePostClick} disabled={busy || !online} aria-busy={m.post.isPending || undefined} data-testid="sj-post">
              {m.post.isPending ? "Posting…" : "Post"}
            </Button>
          )}
          {status === "POSTED" && canReverse(user) && (
            <Button size="md" variant="destructive" onClick={() => setShowReverse(true)} disabled={busy || !online} data-testid="sj-reverse">
              Reverse
            </Button>
          )}
        </div>
      </div>

      {!online && (
        <Alert tone="warning" title="You're offline." className="mb-3" data-testid="sj-offline">
          This action needs a connection. Your draft edits are kept — retry once you reconnect.
        </Alert>
      )}
      {actionError && (
        <Alert tone="destructive" title={actionError} className="mb-3" data-testid="sj-action-error" />
      )}

      {/* Header fields */}
      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label>Mode</Label>
            <ModeSelector
              value={form.mode}
              disabled={!editable}
              onChange={(mode: StockJournalMode) => setForm((f) => ({ ...f, mode }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sj-date">Voucher date</Label>
            <Input
              id="sj-date"
              type="date"
              className="tabular-nums"
              value={form.voucherDate}
              disabled={!editable}
              invalid={!!errors.voucherDate}
              data-testid="sj-date"
              onChange={(e) => setForm((f) => ({ ...f, voucherDate: e.target.value }))}
            />
            {errors.voucherDate && <p className="text-[11.5px] text-destructive-ink">{errors.voucherDate}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sj-item">Item</Label>
            <Select id="sj-item" value={form.itemId} disabled={!editable} invalid={!!errors.itemId} data-testid="sj-item" onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value }))}>
              <option value="">Select an item…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.uom})
                </option>
              ))}
            </Select>
            {errors.itemId && <p className="text-[11.5px] text-destructive-ink">{errors.itemId}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sj-qty">Quantity</Label>
            <div className="relative">
              <Input
                id="sj-qty"
                inputMode="decimal"
                className="pr-12 tabular-nums"
                value={form.quantity}
                disabled={!editable}
                invalid={!!errors.quantity}
                data-testid="sj-qty"
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">{uom}</span>
            </div>
            {errors.quantity && <p className="text-[11.5px] text-destructive-ink">{errors.quantity}</p>}
          </div>
        </div>

        {form.outGodownId && form.itemId && (
          <div className="mt-3">
            <OnHandBadge balance={onHand.data} loading={onHand.isLoading} offline={!online} uom={uom} godownName={outGodownName} />
          </div>
        )}

        {negativeWarning && (
          <Alert tone="warning" className="mt-3" data-testid="sj-negative-warning">
            <span className="flex items-start gap-1.5">
              <AlertTriangle className="mt-px h-4 w-4 flex-none text-warning" aria-hidden />
              <span>
                This quantity exceeds the {onHandQty ? formatQty(onHandQty) : "0"} {uom} on hand
                {outGodownName ? ` at ${outGodownName}` : ""}. Posting will be blocked unless negative stock is authorised.
              </span>
            </span>
          </Alert>
        )}
      </Card>

      {/* Sides */}
      <div className={cn("grid gap-4", form.mode === "TRANSFER" ? "lg:grid-cols-2" : "grid-cols-1")}>
        <SideDimensionBlock
          side="OUT"
          values={{ godownId: form.outGodownId, projectId: form.outProjectId, costCentreId: form.outCostCentreId, purposeId: form.outPurposeId }}
          errors={errors}
          projects={projects}
          godowns={outGodowns}
          costCentres={costCentres}
          purposes={outPurposes}
          rate={rateEstimate}
          value={valueEstimate}
          disabled={!editable}
          onChange={(f, v) => setSide("out", f, v)}
        />
        {form.mode === "TRANSFER" && (
          <SideDimensionBlock
            side="IN"
            values={{ godownId: form.inGodownId, projectId: form.inProjectId, costCentreId: form.inCostCentreId, purposeId: form.inPurposeId }}
            errors={errors}
            projects={projects}
            godowns={inGodowns}
            costCentres={costCentres}
            purposes={inPurposes}
            rate={rateEstimate}
            value={valueEstimate}
            disabled={!editable}
            onChange={(f, v) => setSide("in", f, v)}
          />
        )}
      </div>

      <p className="mt-2 text-right text-[12px] text-muted-foreground" data-testid="sj-estimate-note">
        Rate/value are <span className="font-medium text-foreground">estimated — finalised at posting.</span>
      </p>

      {/* Issued/received/narration */}
      <Card className="mt-4 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sj-issued">Issued by</Label>
            <Select id="sj-issued" value={form.issuedById} disabled={!editable} data-testid="sj-issued" onChange={(e) => setForm((f) => ({ ...f, issuedById: e.target.value }))}>
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sj-received">Received by</Label>
            <Select id="sj-received" value={form.receivedById} disabled={!editable} data-testid="sj-received" onChange={(e) => setForm((f) => ({ ...f, receivedById: e.target.value }))}>
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-1">
            <Label htmlFor="sj-narration">Narration</Label>
            <Textarea id="sj-narration" value={form.narration} disabled={!editable} data-testid="sj-narration" onChange={(e) => setForm((f) => ({ ...f, narration: e.target.value }))} />
          </div>
        </div>
      </Card>

      {/* Posted / approved read-only summary */}
      {journal && status !== "DRAFT" && (
        <Card className="mt-4 p-4" data-testid="sj-post-summary">
          <div className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
            {journal.approvedById && (
              <Info label="Approved">
                {resolveName(users, journal.approvedById)}
                {journal.approvedAt ? ` on ${formatDate(journal.approvedAt)}` : ""}
              </Info>
            )}
            {status === "POSTED" && (
              <Info label="Ledger entry">
                {journal.journalEntryId ? (
                  <Link href={`/ledger/entry-viewer?id=${journal.journalEntryId}`} className="text-accent-ink hover:underline" data-testid="sj-entry-link">
                    View journal entry
                  </Link>
                ) : (
                  <span className="text-muted-foreground">No ledger entry (value-neutral transfer)</span>
                )}
              </Info>
            )}
            {journal.postedAt && <Info label="Posted">{formatDate(journal.postedAt)}</Info>}
            {journal.negativeStockReason && (
              <Info label="Negative stock authorised">{journal.negativeStockReason}</Info>
            )}
          </div>
        </Card>
      )}

      {/* Footer delete for a draft */}
      {!isNew && status === "DRAFT" && canWriteDraft(user) && (
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="md" className="gap-1.5 text-destructive-ink" onClick={handleDelete} disabled={busy} data-testid="sj-delete">
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete draft
          </Button>
        </div>
      )}

      <NegativeStockDialog
        open={showNegative}
        itemName={item?.name ?? "this item"}
        godownName={outGodownName || "this godown"}
        pending={m.post.isPending}
        error={negError}
        onConfirm={(reason) => runPost({ reason })}
        onClose={() => setShowNegative(false)}
      />
      <ReverseDialog
        open={showReverse}
        pending={m.reverse.isPending}
        error={reverseError}
        onConfirm={handleReverse}
        onClose={() => setShowReverse(false)}
      />
    </div>
  );
}

function resolveName(users: { id: string; name: string }[], id: string): string {
  return users.find((u) => u.id === id)?.name ?? id;
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.3px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-foreground [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}
