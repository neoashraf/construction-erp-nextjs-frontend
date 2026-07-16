"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ExternalLink, Loader2, Lock, Plus, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerInput } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { asApiError } from "@/lib/api/errors";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canReadVoucher, canWriteVoucher } from "../access";
import { useJournalVoucher } from "../hooks/useJournalVoucher";
import { useJournalMutations } from "../hooks/useJournalMutations";
import { listAccountOptions, type AccountOption } from "../api/masters";
import {
  clearClusterOnAccountChange,
  emptyJournalForm,
  formToWriteInput,
  isPostable,
  journalToForm,
  mapJournalError,
  totals,
  validateJournal,
  type JournalErrors,
  type JournalFormValues,
  type JournalLineValues,
} from "../schemas/journal.schema";
import { BalancedIndicator } from "./BalancedIndicator";
import { JournalLineRow } from "./JournalLineRow";
import { SortHeadCell } from "./SortHeadCell";
import { PostVoucherDialog } from "./PostVoucherDialog";
import { ReverseVoucherDialog } from "./ReverseVoucherDialog";
import { DiscardChangesDialog } from "./DiscardChangesDialog";
import { VoucherStatusBadge } from "./VoucherStatusBadge";

/**
 * Journal voucher editor (spec §4/§6; FR-GEN-004…-018). Free line grid with the
 * account-driven conditional cluster (P&L / control / other balance-sheet). Post is
 * gated on balance AND every line's applicable tags; the authoritative balance +
 * tag-matrix check is the server's. Reuses the shared voucher-editor shell dialogs
 * from FE-49.
 */
export function JournalVoucherEditor({ voucherId }: { voucherId: string | null }) {
  const router = useRouter();
  const online = useOnline();
  const { toast } = useToast();
  const user = useAuthenticatedUser();
  const canRead = canReadVoucher(user);
  const canWrite = canWriteVoucher(user);

  const isNew = voucherId === null;
  const detail = useJournalVoucher(voucherId);
  const saved = detail.data;

  const [form, setForm] = useState<JournalFormValues>(emptyJournalForm);
  const [errors, setErrors] = useState<JournalErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posting, setPosting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [clusterAnnouncement, setClusterAnnouncement] = useState<string>("");
  const [postAttempted, setPostAttempted] = useState(false);

  const { create, update, remove, post, reverse } = useJournalMutations();

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
  const accountsIndex = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  useEffect(() => {
    if (!saved) return;
    setForm(journalToForm(saved));
    setDirty(false);
  }, [saved]);

  const readOnly = !!saved && saved.status !== "DRAFT";
  const canEdit = !readOnly && canWrite && !posting;
  const t = totals(form.lines);
  const postReady = canEdit && isPostable(form, accountsIndex);

  if (!canRead && !isNew) return <ForbiddenShell />;
  if (voucherId && detail.isLoading) return <LoadingShell />;
  if (voucherId && detail.isError) {
    const e = asApiError(detail.error);
    const notFound = e.code === "NOT_FOUND" || e.status === 404;
    return <ErrorShell notFound={notFound} onBack={() => router.push("/contra-journal/vouchers")} />;
  }
  if (isNew && !canWrite) return <ForbiddenShell />;

  function patch(p: Partial<JournalFormValues>) {
    setBanner(null);
    setDirty(true);
    setForm((prev) => ({ ...prev, ...p }));
    setErrors((prev) => ({ ...prev, voucherDate: p.voucherDate !== undefined ? undefined : prev.voucherDate }));
  }
  function patchLine(key: string, p: Partial<JournalLineValues>) {
    setBanner(null);
    setDirty(true);
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => {
        if (l.key !== key) return l;
        // If the account changed, clear the now-inapplicable cluster fields.
        if (p.accountId !== undefined && p.accountId !== l.accountId) {
          const nextAccount: JournalLineValues = { ...l, ...p };
          const cleared = clearClusterOnAccountChange(nextAccount, accountsIndex);
          setClusterAnnouncement("Tags cleared for this line — the new account has different requirements.");
          return cleared;
        }
        return { ...l, ...p };
      }),
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
      lines: [
        ...prev.lines,
        { key: `l-${Date.now()}`, accountId: "", debit: "", credit: "", projectId: "", costCentreId: "", purposeId: "", partyId: "", narration: "" },
      ],
    }));
  }
  function removeLine(key: string) {
    if (form.lines.length <= 2) return;
    setDirty(true);
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.key !== key) }));
  }

  function applyServerError(err: unknown) {
    const e = asApiError(err);
    setBanner(mapJournalError(e.code, { diff: t.diff }));
  }
  function validateNow(): JournalFormValues | null {
    const res = validateJournal(form, accountsIndex);
    if (res.errors === null) {
      setErrors({});
      return res.values;
    }
    setErrors(res.errors);
    return null;
  }

  async function persist(values: JournalFormValues): Promise<{ id: string; version: number } | null> {
    const input = formToWriteInput(values, accountsIndex);
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
    toast("Journal voucher saved as draft.", "success");
    setDirty(false);
    if (isNew) router.replace(`/contra-journal/vouchers/${res.id}?type=journal`);
  }

  function onPostClick() {
    setPostAttempted(true);
    if (!online) {
      setBanner("You're offline. Post is blocked until you reconnect.");
      return;
    }
    setBanner(null);
    if (!validateNow()) return;
    if (!t.balanced) return;
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
      toast(`Journal voucher posted — ${result.entryNo}.`, "success");
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
      toast(`Journal voucher reversed — ${result.reversalEntryNo}.`, "success");
    } catch (err) {
      setReverseOpen(false);
      applyServerError(err);
    } finally {
      setBusy(false);
    }
  }

  async function onDiscardConfirm() {
    if (saved) {
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
      setDiscardOpen(false);
      router.push("/contra-journal/vouchers");
    }
  }

  const title = isNew
    ? "New journal voucher"
    : readOnly
      ? `Journal voucher ${saved?.entryNo ?? ""}`
      : "Journal voucher (draft)";
  const crumbTail = isNew ? "New" : readOnly ? saved?.entryNo ?? "Voucher" : "Draft";

  return (
    <div className="relative mx-auto max-w-5xl pb-28 lg:pb-24" data-testid="journal-voucher-editor">
      <Breadcrumb items={[
        { label: "Contra & Journal", href: "/contra-journal/vouchers" },
        { label: "Journal vouchers", href: "/contra-journal/vouchers" },
        { label: crumbTail },
      ]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="journal-editor-title">
          {title}
        </h1>
        {saved && <VoucherStatusBadge status={saved.status} />}
        <div className="ml-auto flex items-center gap-2">
          {canEdit && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => (dirty ? setDiscardOpen(true) : router.push("/contra-journal/vouchers"))}
              disabled={busy}
              data-testid="journal-editor-cancel-top"
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
              data-testid="journal-editor-save-top"
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
              title={!postReady ? "Balance the voucher and complete required tags to post." : undefined}
              data-testid="journal-editor-post-top"
            >
              Post
            </Button>
          )}
          {readOnly && saved && saved.journalEntryId && (
            <Button variant="outline" size="md" asChild data-testid="journal-editor-view-ledger-top">
              <Link href={`/ledger/entry-viewer?id=${saved.journalEntryId}`}>View ledger entry</Link>
            </Button>
          )}
          {readOnly && saved && saved.status === "POSTED" && canWrite && (
            <Button
              variant="outline"
              size="md"
              onClick={() => setReverseOpen(true)}
              className="border-destructive/40 text-destructive-ink hover:bg-destructive-soft"
              data-testid="journal-editor-reverse"
            >
              Reverse
            </Button>
          )}
        </div>
      </div>

      {!online && (
        <Alert tone="warning" title="You're offline. Changes weren't saved." className="mb-4" data-testid="journal-editor-offline" />
      )}
      {banner && <Alert tone="destructive" title={banner} className="mb-4" data-testid="journal-editor-banner" />}
      {!readOnly && postAttempted && !t.balanced && (
        <Alert
          tone="destructive"
          title={`Out of balance by ${formatMoney(t.diff)}.`}
          className="mb-4"
          data-testid="journal-editor-unbalanced-banner"
        >
          Debits and credits must be equal before you can post.
        </Alert>
      )}

      {readOnly && saved && (
        <div
          className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-card border border-border bg-surface-2 px-4 py-3 text-[12.5px]"
          data-testid="journal-editor-posted-meta"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            <span className="text-muted-foreground">Posted</span>{" "}
            <span className="font-mono tabular-nums text-foreground">
              {saved.postedAt ? formatDateTime(saved.postedAt) : "—"}
            </span>
            {saved.postedBy && (
              <>
                <span className="text-muted-foreground">by</span>
                <span className="font-semibold text-foreground">{saved.postedBy}</span>
              </>
            )}
          </span>
          {saved.journalEntryId && (
            <Link
              href={`/ledger/entry-viewer?id=${saved.journalEntryId}`}
              className="inline-flex items-center gap-1 font-semibold text-accent-ink hover:underline"
              data-testid="journal-editor-view-ledger"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Ledger entry {saved.entryNo}
            </Link>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Posted vouchers are read-only — correct by Reverse.
          </span>
        </div>
      )}

      <p aria-live="polite" className="sr-only" data-testid="journal-editor-cluster-announce">
        {clusterAnnouncement}
      </p>

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <div>
            <Label htmlFor="journal-date">Voucher date *</Label>
            <DatePickerInput
              id="journal-date"
              value={form.voucherDate}
              onChange={(v) => patch({ voucherDate: v })}
              invalid={!!errors.voucherDate}
              disabled={!canEdit}
            />
            {errors.voucherDate && (
              <p className="mt-1 text-[12px] font-medium text-destructive">{errors.voucherDate}</p>
            )}
          </div>
          <div>
            <Label htmlFor="journal-narration">Narration — optional</Label>
            <Textarea
              id="journal-narration"
              value={form.narration}
              onChange={(e) => patch({ narration: e.target.value })}
              disabled={!canEdit}
              rows={2}
              className="min-h-[64px] resize-none"
              data-testid="journal-editor-narration"
            />
          </div>
        </div>
      </Card>

      <Card className="mt-4 p-5" data-testid="journal-editor-lines">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-[13px] font-bold text-foreground">Lines</h2>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={addLine}
            disabled={!canEdit}
            data-testid="journal-editor-add-line"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add line
          </Button>
        </div>
        <div className="hidden grid-cols-[24px_1.6fr_1.4fr_1fr_1fr_0.8fr_auto] gap-2 border-b border-border pb-2 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground md:grid">
          <span>#</span>
          <span>Account</span>
          <span>Dimensions / party — per account</span>
          <SortHeadCell label="Debit" />
          <SortHeadCell label="Credit" />
          <span>Over-budget</span>
          <span />
        </div>
        {form.lines.map((l, i) => (
          <JournalLineRow
            key={l.key}
            line={l}
            lineNo={i + 1}
            errors={errors.lines?.[l.key]}
            accounts={accounts}
            disabled={!canEdit}
            canRemove={form.lines.length > 2}
            onChange={(p) => patchLine(l.key, p)}
            onRemove={() => removeLine(l.key)}
          />
        ))}
        <div className="mt-2 flex justify-end gap-6 border-t border-border pt-3 text-[12.5px]" data-testid="journal-editor-totals">
          <span className="text-muted-foreground">
            TOTAL DR{" "}
            <span className="font-mono font-bold tabular-nums text-foreground">{formatMoney(t.debit)}</span>
          </span>
          <span className="text-muted-foreground">
            TOTAL CR{" "}
            <span className="font-mono font-bold tabular-nums text-foreground">{formatMoney(t.credit)}</span>
          </span>
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-3 shadow-lg lg:pl-[var(--sidebar-w,0)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <BalancedIndicator debit={t.debit} credit={t.credit} balanced={t.balanced} diff={t.diff} lineCount={form.lines.length} posted={readOnly} />
          <div className="ml-auto flex items-center gap-2">
            {canEdit && (
              <Button
                variant="ghost"
                size="md"
                onClick={() => (dirty ? setDiscardOpen(true) : router.push("/contra-journal/vouchers"))}
                disabled={busy}
                data-testid="journal-editor-cancel"
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
                data-testid="journal-editor-save"
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
                title={!postReady ? "Balance the voucher and complete required tags to post." : undefined}
                className="gap-1.5"
                data-testid="journal-editor-post"
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
                data-testid="journal-editor-reverse-bottom"
              >
                <XCircle className="h-4 w-4" aria-hidden />
                Reverse voucher
              </Button>
            )}
          </div>
        </div>
      </div>

      {posting && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-canvas/60 pt-32" role="alertdialog" aria-modal="true" data-testid="journal-editor-posting-overlay">
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
        title="Post this journal voucher?"
        totalDebit={t.debit}
        busy={busy || posting}
        onConfirm={onPostConfirm}
        onCancel={() => setPostOpen(false)}
      />
      <ReverseVoucherDialog
        open={reverseOpen}
        title="Reverse this journal voucher?"
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
      <Card className="p-5" data-testid="journal-editor-loading">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="mb-2 h-9 w-full" />)}
      </Card>
    </div>
  );
}

function ErrorShell({ notFound, onBack }: { notFound: boolean; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-5xl">
      <Breadcrumb items={[{ label: "Contra & Journal" }, { label: "Vouchers", href: "/contra-journal/vouchers" }, { label: "Voucher" }]} />
      <Card className="mt-6 p-10" data-testid="journal-editor-error">
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
      <Card className="mt-6 p-10" data-testid="journal-editor-403">
        <EmptyState
          icon={Lock}
          title="You don't have permission to open journal vouchers."
          description="This screen is visible to Accounts Manager and Admin only."
        />
      </Card>
    </div>
  );
}
