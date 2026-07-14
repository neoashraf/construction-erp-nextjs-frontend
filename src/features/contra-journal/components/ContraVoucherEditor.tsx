"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ExternalLink, Loader2, Lock, Plus, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerInput } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { asApiError } from "@/lib/api/errors";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canReadVoucher, canWriteVoucher } from "../access";
import { useContraVoucher } from "../hooks/useContraVoucher";
import { useContraMutations } from "../hooks/useContraMutations";
import { isBankOrCashAccount, listAccountOptions, type AccountOption } from "../api/masters";
import {
  contraToForm,
  emptyContraForm,
  formToWriteInput,
  isPostable,
  mapContraError,
  totals,
  validateContra,
  type ContraErrors,
  type ContraFormValues,
  type ContraLineValues,
} from "../schemas/contra.schema";
import { BalancedIndicator } from "./BalancedIndicator";
import { ContraLineRow } from "./ContraLineRow";
import { PostVoucherDialog } from "./PostVoucherDialog";
import { ReverseVoucherDialog } from "./ReverseVoucherDialog";
import { DiscardChangesDialog } from "./DiscardChangesDialog";
import { VoucherStatusBadge } from "./VoucherStatusBadge";

/**
 * Contra voucher editor (spec §4/§6; FR-GEN-001…-018). One `status`-driven surface:
 * editable while DRAFT, read-only once POSTED (Reverse only) or CANCELLED (view only).
 * Live balanced indicator; every line's account picker filtered to active bank/cash
 * accounts. Post/Reverse are server-confirmed behind mandatory dialogs.
 */
export function ContraVoucherEditor({ voucherId }: { voucherId: string | null }) {
  const router = useRouter();
  const online = useOnline();
  const { toast } = useToast();
  const user = useAuthenticatedUser();
  const canRead = canReadVoucher(user);
  const canWrite = canWriteVoucher(user);

  const isNew = voucherId === null;
  const detail = useContraVoucher(voucherId);
  const saved = detail.data;

  const [form, setForm] = useState<ContraFormValues>(emptyContraForm);
  const [errors, setErrors] = useState<ContraErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posting, setPosting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const { create, update, remove, post, reverse } = useContraMutations();

  const scope = useMemo(
    () => ({ companyId: user.companyId, financialYearId: user.financialYearId }),
    [user.companyId, user.financialYearId],
  );
  const accountsQ = useQuery({
    queryKey: queryKeys.list("contra-journal", "accounts", scope, {}),
    queryFn: () => listAccountOptions(),
    staleTime: 60_000,
  });
  const accounts: AccountOption[] = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);
  const bankCash = useMemo(() => accounts.filter((a) => a.isActive && isBankOrCashAccount(a)), [accounts]);
  const accountsIndex = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const bankCashIds = useMemo(() => new Set(bankCash.map((a) => a.id)), [bankCash]);
  const lookup = useMemo(
    () => ({ isBankCash: (id: string) => bankCashIds.has(id) || (accountsIndex.get(id)?.isBankCash ?? false) }),
    [bankCashIds, accountsIndex],
  );

  useEffect(() => {
    if (!saved) return;
    setForm(contraToForm(saved));
    setDirty(false);
  }, [saved]);

  const readOnly = !!saved && saved.status !== "DRAFT";
  const canEdit = !readOnly && canWrite && !posting;
  const t = totals(form.lines);
  const postReady = canEdit && isPostable(form, lookup);

  if (!canRead && !isNew) {
    return (
      <ForbiddenShell />
    );
  }

  if (voucherId && detail.isLoading) return <LoadingShell />;
  if (voucherId && detail.isError) {
    const e = asApiError(detail.error);
    const notFound = e.code === "NOT_FOUND" || e.status === 404;
    return (
      <ErrorShell notFound={notFound} onBack={() => router.push("/contra-journal/vouchers")} />
    );
  }
  if (isNew && !canWrite) return <ForbiddenShell />;

  function patch(p: Partial<ContraFormValues>) {
    setBanner(null);
    setDirty(true);
    setForm((prev) => ({ ...prev, ...p }));
    setErrors((prev) => ({ ...prev, voucherDate: p.voucherDate !== undefined ? undefined : prev.voucherDate }));
  }
  function patchLine(key: string, p: Partial<ContraLineValues>) {
    setBanner(null);
    setDirty(true);
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.key === key ? { ...l, ...p } : l)),
    }));
    setErrors((prev) => {
      if (!prev.lines) return prev;
      const next = { ...prev.lines };
      delete next[key];
      return { ...prev, lines: Object.keys(next).length ? next : undefined };
    });
  }
  function addLine() {
    setDirty(true);
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, { key: `l-${Date.now()}`, accountId: "", debit: "", credit: "", narration: "" }],
    }));
  }
  function removeLine(key: string) {
    if (form.lines.length <= 2) return;
    setDirty(true);
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.key !== key) }));
  }

  function applyServerError(err: unknown) {
    const e = asApiError(err);
    setBanner(mapContraError(e.code, { diff: t.diff }));
  }
  function validateNow(): ContraFormValues | null {
    const res = validateContra(form, lookup);
    if (res.errors === null) {
      setErrors({});
      return res.values;
    }
    setErrors(res.errors);
    return null;
  }

  async function persist(values: ContraFormValues): Promise<{ id: string; version: number } | null> {
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
    const values = validateNow();
    if (!values) return;
    setBusy(true);
    const res = await persist(values);
    setBusy(false);
    if (!res) return;
    toast("Contra voucher saved as draft.", "success");
    setDirty(false);
    if (isNew) router.replace(`/contra-journal/vouchers/${res.id}?type=contra`);
  }

  function onPostClick() {
    if (!online) {
      setBanner("You're offline. Post is blocked until you reconnect.");
      return;
    }
    setBanner(null);
    if (!validateNow()) return;
    setPostOpen(true);
  }

  async function onPostConfirm() {
    const values = validateNow();
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
      toast(`Contra voucher posted — ${result.entryNo}.`, "success");
      setDirty(false);
    } catch (err) {
      setPostOpen(false);
      applyServerError(err);
    } finally {
      setBusy(false);
      setPosting(false);
    }
  }

  async function onReverseConfirm(reason: string) {
    if (!saved) return;
    setBusy(true);
    try {
      const result = await reverse.mutateAsync({ id: saved.id, reason, version: saved.version });
      setReverseOpen(false);
      toast(`Contra voucher reversed — ${result.reversalEntryNo}.`, "success");
    } catch (err) {
      setReverseOpen(false);
      applyServerError(err);
    } finally {
      setBusy(false);
    }
  }

  async function onDiscardConfirm() {
    if (saved) {
      // Existing draft: hard-delete + go to list.
      setBusy(true);
      try {
        await remove.mutateAsync({ id: saved.id });
        setDiscardOpen(false);
        toast("Draft voucher discarded.", "success");
        router.push("/contra-journal/vouchers");
      } catch (err) {
        setDiscardOpen(false);
        applyServerError(err);
      } finally {
        setBusy(false);
      }
    } else {
      // New draft: reset the form + navigate to list.
      setDiscardOpen(false);
      router.push("/contra-journal/vouchers");
    }
  }

  const title = isNew
    ? "New contra voucher"
    : readOnly
      ? `Contra voucher ${saved?.entryNo ?? ""}`
      : "Edit contra voucher (draft)";
  const crumbTail = isNew ? "New" : readOnly ? saved?.entryNo ?? "Voucher" : "Edit";

  return (
    <div className="relative mx-auto max-w-5xl pb-28 lg:pb-24" data-testid="contra-voucher-editor">
      <Breadcrumb items={[
        { label: "Contra & Journal", href: "/contra-journal/vouchers" },
        { label: "Vouchers", href: "/contra-journal/vouchers" },
        { label: crumbTail },
      ]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="contra-editor-title">
          {title}
        </h1>
        {saved && <VoucherStatusBadge status={saved.status} />}
        {saved?.entryNo && <Badge tone="info" className="font-mono">{saved.entryNo}</Badge>}
      </div>

      {!online && (
        <Alert tone="warning" title="You're offline. Changes weren't saved." className="mb-4" data-testid="contra-editor-offline" />
      )}
      {banner && <Alert tone="destructive" title={banner} className="mb-4" data-testid="contra-editor-banner" />}
      {readOnly && (
        <div
          className="mb-4 flex items-center gap-2 rounded-card border border-accent-soft bg-accent-soft/40 p-3 text-[12.5px] text-muted-foreground"
          data-testid="contra-editor-immutability"
        >
          <Lock className="h-4 w-4 text-accent-ink" aria-hidden />
          Posted vouchers can&rsquo;t be edited. Reverse this voucher to correct it.
        </div>
      )}

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <div>
            <Label htmlFor="contra-date">Voucher date</Label>
            <DatePickerInput
              id="contra-date"
              value={form.voucherDate}
              onChange={(v) => patch({ voucherDate: v })}
              invalid={!!errors.voucherDate}
              disabled={!canEdit}
            />
            {errors.voucherDate && (
              <p className="mt-1 text-[12px] font-medium text-destructive" data-testid="contra-editor-date-err">{errors.voucherDate}</p>
            )}
          </div>
          <div>
            <Label htmlFor="contra-narration">Narration</Label>
            <Textarea
              id="contra-narration"
              value={form.narration}
              onChange={(e) => patch({ narration: e.target.value })}
              disabled={!canEdit}
              rows={2}
              className="min-h-[64px] resize-none"
              data-testid="contra-editor-narration"
            />
          </div>
        </div>
      </Card>

      <Card className="mt-5 p-5" data-testid="contra-editor-lines">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-[13px] font-bold text-foreground">Lines</h2>
          <span className="text-[11.5px] text-muted-foreground">Bank/cash accounts only · debit or credit per line</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={addLine}
            disabled={!canEdit}
            data-testid="contra-editor-add-line"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add line
          </Button>
        </div>
        <div className="grid grid-cols-[1.8fr_1fr_1fr_1.2fr_auto] gap-2 border-b border-border pb-2 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          <span>Account</span>
          <span className="text-right">Debit</span>
          <span className="text-right">Credit</span>
          <span>Narration</span>
          <span />
        </div>
        {form.lines.map((l) => (
          <ContraLineRow
            key={l.key}
            line={l}
            errors={errors.lines?.[l.key]}
            bankCashAccounts={bankCash}
            allAccountsIndex={accountsIndex}
            disabled={!canEdit}
            canRemove={form.lines.length > 2}
            onChange={(p) => patchLine(l.key, p)}
            onRemove={() => removeLine(l.key)}
          />
        ))}
      </Card>

      {saved && saved.journalEntryId && (
        <Link
          href={`/ledger/entry-viewer?id=${saved.journalEntryId}`}
          className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent-ink hover:underline"
          data-testid="contra-editor-view-ledger"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          View ledger entry
        </Link>
      )}

      {/* Fixed action bar. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-3 shadow-lg lg:pl-[var(--sidebar-w,0)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <BalancedIndicator debit={t.debit} credit={t.credit} balanced={t.balanced} diff={t.diff} />
          <div className="ml-auto flex items-center gap-2">
            {canEdit && (
              <Button
                variant="ghost"
                size="md"
                onClick={() => (dirty ? setDiscardOpen(true) : router.push("/contra-journal/vouchers"))}
                disabled={busy}
                data-testid="contra-editor-cancel"
              >
                Cancel
              </Button>
            )}
            {canEdit && (
              <Button
                variant="outline"
                size="md"
                onClick={onSaveDraft}
                disabled={busy}
                data-testid="contra-editor-save"
              >
                {busy && !posting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  "Save draft"
                )}
              </Button>
            )}
            {canEdit && (
              <Button
                size="md"
                onClick={onPostClick}
                disabled={busy || !postReady}
                title={!postReady ? "Balance the voucher to post." : undefined}
                className="gap-1.5"
                data-testid="contra-editor-post"
              >
                <ArrowRight className="h-4 w-4" aria-hidden />
                Post
              </Button>
            )}
            {readOnly && saved && saved.status === "POSTED" && canWrite && (
              <Button
                variant="outline"
                size="md"
                onClick={() => setReverseOpen(true)}
                className="border-destructive/40 text-destructive-ink hover:bg-destructive-soft"
                data-testid="contra-editor-reverse"
              >
                <XCircle className="h-4 w-4" aria-hidden />
                Reverse
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
          data-testid="contra-editor-posting-overlay"
        >
          <div className="flex items-center gap-3 rounded-card border border-info-soft bg-surface px-5 py-4 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-info" aria-hidden />
            <div>
              <div className="text-[13.5px] font-bold text-info">Posting…</div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                Allocating the gapless voucher number and writing the balanced ledger entry.
              </div>
            </div>
          </div>
        </div>
      )}

      <PostVoucherDialog
        open={postOpen}
        title="Post this contra voucher?"
        totalDebit={t.debit}
        busy={busy || posting}
        onConfirm={onPostConfirm}
        onCancel={() => setPostOpen(false)}
      />
      <ReverseVoucherDialog
        open={reverseOpen}
        title="Reverse this contra voucher?"
        busy={busy}
        onConfirm={onReverseConfirm}
        onCancel={() => setReverseOpen(false)}
      />
      <DiscardChangesDialog
        open={discardOpen}
        onConfirm={onDiscardConfirm}
        onCancel={() => setDiscardOpen(false)}
      />
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="mx-auto max-w-5xl">
      <Breadcrumb items={[{ label: "Contra & Journal" }, { label: "Vouchers", href: "/contra-journal/vouchers" }, { label: "Voucher" }]} />
      <div className="mb-3 mt-1 flex items-center gap-3">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-6 w-20 rounded-pill" />
      </div>
      <Card className="p-5" data-testid="contra-editor-loading">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="mb-2 h-9 w-full" />)}
      </Card>
    </div>
  );
}

function ErrorShell({ notFound, onBack }: { notFound: boolean; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-5xl">
      <Breadcrumb items={[{ label: "Contra & Journal" }, { label: "Vouchers", href: "/contra-journal/vouchers" }, { label: "Voucher" }]} />
      <Card className="mt-6 p-10" data-testid="contra-editor-error">
        <EmptyState
          icon={Lock}
          title={notFound ? "Voucher not found." : "Couldn't load this voucher."}
          action={<Button size="md" onClick={onBack}>Back</Button>}
        />
      </Card>
    </div>
  );
}

function ForbiddenShell() {
  return (
    <div className="mx-auto max-w-5xl">
      <Breadcrumb items={[{ label: "Contra & Journal" }, { label: "Vouchers", href: "/contra-journal/vouchers" }, { label: "Voucher" }]} />
      <Card className="mt-6 p-10" data-testid="contra-editor-403">
        <EmptyState
          icon={Lock}
          title="You don't have permission to open contra vouchers."
          description="This screen is visible to Accounts Manager and Admin only."
        />
      </Card>
    </div>
  );
}
