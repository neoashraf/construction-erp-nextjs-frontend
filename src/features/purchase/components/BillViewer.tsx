"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { toDecimal } from "@/lib/money";
import { moneyWithSymbol } from "../format";
import { useOnline } from "@/lib/hooks/use-online";
import { asApiError } from "@/lib/api";
import { useMasterLookups, useAccountOptions } from "@/lib/masters/lookups";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canCancelBill } from "../access";
import { useBillMutations } from "../hooks/useBillMutations";
import { useBillLedgerEntry } from "../hooks/useBillViewer";
import {
  useProjectOptions,
  useSupplierOptions,
  useItemOptions,
  useGodownOptions,
  usePurposeOptions,
} from "../hooks/usePoOptions";
import { BillStatusBadge } from "./BillStatusBadge";
import { BillLedgerLinesTable, type LedgerLineResolve } from "./BillLedgerLinesTable";
import { BillInventoryPanel, type InventoryResolve } from "./BillInventoryPanel";
import { BillLinkagePanel } from "./BillLinkagePanel";
import { CancelBillDialog } from "./CancelBillDialog";
import { RepostDialog } from "./RepostDialog";
import { mapBillError, isCancellableBill, formToWriteInput } from "../schemas/bill.schema";
import { type PurchaseBill } from "../types";
import type { BillFormValues } from "../schemas/bill.schema";

/**
 * Purchase Bill viewer (brief §Scope 9-14; spec §4/§6; FR-PUR-020, FR-PUR-022, FR-PUR-023,
 * FR-PUR-024; Purchase Bill.dc.html "Viewer · posted bill" frame). Read-only representation of
 * a POSTED / CANCELLED bill: identity header + read-only note, the balanced ledger-lines table
 * (from the LED entry, ID→name resolved), an inventory-movements panel beside a stacked
 * outstanding + reversal-linkage rail, and a footer action bar. Never re-derives the balanced
 * Dr/Cr — displays only what the backend wrote. Cancel + Repost are the ONLY further actions;
 * both `purchase:cancel`-gated with a mandatory reason confirm dialog. Editing a posted bill is
 * deliberately impossible (no field is ever editable for any role — FR-PUR-024).
 */
export function BillViewer({
  bill,
  repostFormBuilder,
}: {
  bill: PurchaseBill;
  /** Supplied by the page shell — builds the corrected form for a Repost. */
  repostFormBuilder?: () => BillFormValues | null;
}) {
  const router = useRouter();
  const online = useOnline();
  const { toast } = useToast();
  const user = useAuthenticatedUser();
  const canCancel = canCancelBill(user);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [repostOpen, setRepostOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const { cancel, repost } = useBillMutations();
  const entryQuery = useBillLedgerEntry(bill.journalEntryId);

  // ── Master lookups → display names (shared lib; degrades to the raw id on a miss). ──
  const lookups = useMasterLookups();
  const { accounts } = useAccountOptions();
  const suppliers = useSupplierOptions().data;
  const projects = useProjectOptions().data;
  const items = useItemOptions().data;
  const godowns = useGodownOptions(bill.projectId).data;
  const purposes = usePurposeOptions(bill.projectId).data;

  const supplierName = useMemo(
    () => suppliers?.find((s) => s.id === bill.supplierId)?.name ?? bill.supplierId,
    [suppliers, bill.supplierId],
  );
  const projectName = useMemo(
    () => projects?.find((p) => p.id === bill.projectId)?.name ?? bill.projectId,
    [projects, bill.projectId],
  );

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const itemMap = useMemo(() => new Map((items ?? []).map((i) => [i.id, `${i.name}`])), [items]);
  const godownMap = useMemo(() => new Map((godowns ?? []).map((g) => [g.id, g.name])), [godowns]);
  const purposeMap = useMemo(() => new Map((purposes ?? []).map((p) => [p.id, p.name])), [purposes]);

  const ledgerResolve: LedgerLineResolve = useMemo(
    () => ({
      account: (id) => {
        const a = accountMap.get(id);
        return { code: a?.code ?? id, name: a?.name ?? null };
      },
      party: (id) => (id ? lookups.party(id) : null),
      project: (id) => (id ? lookups.project(id) : null),
      costCentre: (id) => (id ? lookups.costCentre(id) : null),
      purpose: (id) => (id ? (purposeMap.get(id) ?? id) : null),
      godown: (id) => (id ? (godownMap.get(id) ?? id) : null),
    }),
    [accountMap, lookups, purposeMap, godownMap],
  );

  const inventoryResolve: InventoryResolve = useMemo(
    () => ({
      godown: (id) => (id ? (godownMap.get(id) ?? id) : null),
      item: (id) => (id ? (itemMap.get(id) ?? id) : null),
    }),
    [godownMap, itemMap],
  );

  async function onCancelConfirm(reason: string) {
    if (!online) {
      setCancelOpen(false);
      setBanner("You're offline. Cancellation isn't available.");
      return;
    }
    setBusy(true);
    try {
      const res = await cancel.mutateAsync({ id: bill.id, reason, version: bill.version });
      setBusy(false);
      setCancelOpen(false);
      toast("Purchase bill cancelled.", "success");
      setBanner(`Reversal entry ${res.reversalEntryNo} posted.`);
    } catch (err) {
      setBusy(false);
      setCancelOpen(false);
      const e = asApiError(err);
      setBanner(mapBillError(e.code).message);
    }
  }

  async function onRepostConfirm(reason: string) {
    if (!online) {
      setRepostOpen(false);
      setBanner("You're offline. Correction isn't available.");
      return;
    }
    const values = repostFormBuilder?.();
    if (!values) {
      setRepostOpen(false);
      setBanner("Please review the bill and try again.");
      return;
    }
    setBusy(true);
    try {
      const res = await repost.mutateAsync({
        id: bill.id,
        input: { ...formToWriteInput(values), reason, version: bill.version },
      });
      setBusy(false);
      setRepostOpen(false);
      toast(`Purchase bill corrected — new entry ${res.entryNo}.`, "success");
      router.replace(`/purchase/bills/${res.id}`);
    } catch (err) {
      setBusy(false);
      setRepostOpen(false);
      const e = asApiError(err);
      setBanner(mapBillError(e.code).message);
    }
  }

  const isPosted = bill.status === "POSTED";
  const isCancelled = bill.status === "CANCELLED";
  const canWriteAction = canCancel && isCancellableBill(bill.status);

  const paymentsApplied = (() => {
    const applied = toDecimal(bill.netPayableAmount).minus(toDecimal(bill.outstandingAmount));
    return applied.isNegative() ? "0.0000" : applied.toFixed(4);
  })();

  return (
    <div className="mx-auto max-w-6xl pb-6" data-testid="bill-viewer">
      <Breadcrumb
        items={[
          { label: "Purchase bills", href: "/purchase/bills" },
          { label: bill.entryNo ?? "Bill" },
        ]}
      />
      <div className="mb-[15px] mt-1 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-[22px] font-bold tracking-[-0.01em]" data-testid="bill-viewer-title">
          {bill.entryNo ?? "Purchase bill"}
        </h1>
        <BillStatusBadge status={bill.status} />
      </div>

      {banner && (
        <Alert
          tone={isCancelled || banner.startsWith("Reversal entry") ? "info" : "destructive"}
          title={banner}
          className="mb-4"
          data-testid="bill-viewer-banner"
        />
      )}

      {isCancelled && (
        <Alert
          tone="warning"
          title={`This bill was cancelled. Its original number ${bill.entryNo ?? "—"} is retained on the reversed entry.`}
          className="mb-4"
          data-testid="bill-cancelled-ribbon"
        />
      )}

      {/* HEADER BLOCK */}
      <Card className="px-[18px] py-4">
        <div className="grid grid-cols-2 gap-x-[22px] gap-y-4 md:grid-cols-4">
          <Meta label="Supplier" value={supplierName} sub={bill.supplierInvoiceRef ? `Inv. ${bill.supplierInvoiceRef}` : null} />
          <Meta label="Project" value={projectName} sub={bill.purchaseOrderId ? `Linked ${bill.purchaseOrderId}` : null} />
          <Meta
            label="Bill / Due date"
            value={`${formatDate(bill.billDate)} → ${formatDate(bill.dueDate)}`}
            tabular
          />
          <Meta
            label="Posted at / by"
            value={formatPostedAt(bill.postedAt)}
            sub={bill.postedBy ? lookups.party(bill.postedBy) || bill.postedBy : null}
            tabular
          />
        </div>
        {isPosted && (
          <div
            className="mt-3.5 flex items-center gap-[11px] border-t border-border pt-[13px]"
            data-testid="bill-readonly-note"
          >
            <span
              className="inline-flex h-[21px] flex-none items-center rounded-[6px] bg-border px-[9px] text-[10.5px] font-bold uppercase tracking-[0.5px] text-muted-foreground"
              data-testid="bill-readonly-chip"
            >
              Read-only
            </span>
            <span className="text-[12.5px] leading-[1.45] text-muted-foreground">
              Posted bills can&apos;t be edited — corrections are a reverse-and-repost.
            </span>
          </div>
        )}
        {bill.narration && (
          <div className="mt-3.5 border-t border-border pt-[13px]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.4px] text-faint">Narration</div>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground [overflow-wrap:anywhere]">
              {bill.narration}
            </p>
          </div>
        )}
      </Card>

      {/* BALANCED LEDGER LINES */}
      <Card className="mt-4 overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-[9px] border-b border-border px-4 py-[13px]">
          <span className="text-[13px] font-semibold text-foreground">Balanced ledger lines</span>
          <span className="text-[12px] text-faint">PURCHASE journal · auto-built at post</span>
        </div>

        {entryQuery.isLoading ? (
          <p className="px-4 py-4 text-[12.5px] text-faint">Loading ledger lines…</p>
        ) : entryQuery.isError ? (
          <div className="p-4">
            <Alert
              tone="destructive"
              title={
                asApiError(entryQuery.error).code === "FORBIDDEN"
                  ? "You don't have access to the ledger entry for this bill."
                  : "Couldn't load the ledger lines for this bill."
              }
              data-testid="bill-ledger-error"
            >
              <Button size="sm" onClick={() => entryQuery.refetch()}>
                Retry
              </Button>
            </Alert>
          </div>
        ) : entryQuery.data ? (
          <BillLedgerLinesTable lines={entryQuery.data.lines} resolve={ledgerResolve} />
        ) : (
          <p className="px-4 py-4 text-[12.5px] text-faint">This bill has no posted ledger entry yet.</p>
        )}
      </Card>

      {/* INVENTORY MOVEMENTS + OUTSTANDING / LINKAGE */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <BillInventoryPanel lines={bill.lines} resolve={inventoryResolve} />
        <div className="flex flex-col gap-4">
          <OutstandingCard
            outstanding={bill.outstandingAmount}
            netPayable={bill.netPayableAmount}
            paymentsApplied={paymentsApplied}
            journalEntryId={bill.journalEntryId}
          />
          <BillLinkagePanel entry={entryQuery.data ?? null} />
        </div>
      </div>

      {/* ACTION BAR */}
      <div
        className="mt-3 flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface px-4 py-[13px] shadow-sm"
        data-testid="bill-viewer-footer"
      >
        <span className="text-[12px] text-faint">
          Correction = reverse-and-repost · original number is retained.
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="md" onClick={() => router.push("/purchase/bills")} data-testid="bill-viewer-back">
            Back
          </Button>
          {canWriteAction && (
            <>
              <Button
                size="md"
                variant="destructive-outline"
                onClick={() => {
                  setBanner(null);
                  setCancelOpen(true);
                }}
                disabled={busy}
                data-testid="bill-cancel"
              >
                Cancel bill
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setBanner(null);
                  setRepostOpen(true);
                }}
                disabled={busy}
                data-testid="bill-repost"
              >
                Repost (correct)
              </Button>
            </>
          )}
        </div>
      </div>

      <CancelBillDialog
        open={cancelOpen}
        busy={busy}
        entryNo={bill.entryNo}
        onOpenChange={(o) => !o && setCancelOpen(false)}
        onConfirm={onCancelConfirm}
      />
      <RepostDialog
        open={repostOpen}
        busy={busy}
        entryNo={bill.entryNo}
        onOpenChange={(o) => !o && setRepostOpen(false)}
        onConfirm={onRepostConfirm}
      />
    </div>
  );
}

/** ISO timestamp → "DD/MM/YYYY · HH:MM" (design's Posted at / by value). */
function formatPostedAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const date = formatDate(iso);
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${date} · ${hh}:${mm}`;
  } catch {
    return "—";
  }
}

function Meta({
  label,
  value,
  sub,
  tabular,
}: {
  label: string;
  value: string;
  sub?: string | null;
  tabular?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.4px] text-faint">{label}</div>
      <div
        className={
          "mt-1 text-[14px] font-semibold text-foreground [overflow-wrap:anywhere]" +
          (tabular ? " tabular-nums" : "")
        }
      >
        {value}
      </div>
      {sub && <div className="mt-px text-[11.5px] text-muted-foreground [overflow-wrap:anywhere]">{sub}</div>}
    </div>
  );
}

/**
 * Outstanding rail card (Purchase Bill.dc.html viewer): amber value, a "Net payable {n} −
 * payments applied {p}" subtitle, and the "View ledger entry ↗" link. Payments applied is a
 * client derivation — PAY owns the authoritative per-bill applied figure (FR-PUR-020).
 */
function OutstandingCard({
  outstanding,
  netPayable,
  paymentsApplied,
  journalEntryId,
}: {
  outstanding: string;
  netPayable: string;
  paymentsApplied: string;
  journalEntryId: string | null;
}) {
  return (
    <Card className="px-[18px] py-4" data-testid="bill-outstanding-card">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Outstanding</div>
      <div className="mt-1.5 font-mono text-[24px] font-bold tabular-nums text-warning-ink">
        {moneyWithSymbol(outstanding)}
      </div>
      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
        Net payable {moneyWithSymbol(netPayable)} − payments applied {moneyWithSymbol(paymentsApplied)}
      </p>
      {journalEntryId && (
        <Link
          href={`/ledger/entry-viewer?id=${journalEntryId}`}
          className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-info hover:underline"
          data-testid="bill-view-ledger"
        >
          View ledger entry <span aria-hidden>↗</span>
        </Link>
      )}
    </Card>
  );
}
