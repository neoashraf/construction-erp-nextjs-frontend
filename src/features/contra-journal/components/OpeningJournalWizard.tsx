"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Check, Inbox, Loader2, Lock, Plus, WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerInput } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import { asApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { parseDate } from "@/lib/format";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canWriteVoucher } from "../access";
import { useOpeningAssembly, useOpeningPost } from "../hooks/useOpeningAssembly";
import { useJournalVoucher } from "../hooks/useJournalVoucher";
import { OneTimeActionNotice } from "./OneTimeActionNotice";
import { OpeningLinesReviewTable } from "./OpeningLinesReviewTable";
import { OpeningPostDialog } from "./OpeningPostDialog";
import { OpeningPostedRecap } from "./OpeningPostedRecap";
import { mapJournalError } from "../schemas/journal.schema";

/**
 * Opening journal wizard (spec §4/§6; FR-GEN-009…-013/-015). Review-and-post — no
 * draft, no line editing. On load: check for an existing OPENING (recap replaces the
 * assembly UI) + fetch the derived preview. Post is a single confirmed action that
 * assembles + posts in one call. Every module error code maps to its exact spec §8
 * copy — `OPENING_ALREADY_EXISTS`, `OPENING_ACCOUNT_NOT_CONFIGURED`, `UNBALANCED_ENTRY`,
 * `PERIOD_CLOSED`, `NO_PERIOD_DEFINED` — plus `FORBIDDEN` for the read gate.
 */
export function OpeningJournalWizard() {
  const online = useOnline();
  const { toast } = useToast();
  const user = useAuthenticatedUser();
  const canWrite = canWriteVoucher(user);

  const [voucherDate, setVoucherDate] = useState(defaultToday());
  const [narration, setNarration] = useState("Go-live opening balances");
  const [postOpen, setPostOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const { preview, existing } = useOpeningAssembly();
  const existingId = existing.data?.id ?? null;
  const existingFull = useJournalVoucher(existingId);
  const post = useOpeningPost();

  if (!canWrite) {
    return (
      <div className="mx-auto max-w-4xl">
        <Breadcrumb items={[{ label: "Contra & Journal" }, { label: "Opening journal" }]} />
        <Card className="mt-6 p-10" data-testid="opening-403">
          <EmptyState
            icon={Lock}
            title="You don't have permission to post the opening journal."
            description="This action is limited to Admin and Accounts Manager."
          />
        </Card>
      </div>
    );
  }

  // Already posted → recap replaces the assembly UI (FR-GEN-012). Load the full
  // voucher so the recap can show the balanced totals; while loading, show a spinner.
  if (existing.data) {
    if (existingFull.isLoading || !existingFull.data) {
      return <LoadingShell />;
    }
    return (
      <div className="mx-auto max-w-4xl">
        <Breadcrumb items={[{ label: "Contra & Journal" }, { label: "Opening journal" }]} />
        <div className="mb-4 mt-1">
          <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="opening-title">
            Opening journal
          </h1>
        </div>
        <OpeningPostedRecap voucher={existingFull.data} />
      </div>
    );
  }

  if (preview.isLoading) return <LoadingShell />;

  const configGap = preview.data?.configGap ?? false;
  const lines = preview.data?.lines ?? [];
  const totalDebit = preview.data?.totalDebit ?? "0.0000";
  const totalCredit = preview.data?.totalCredit ?? "0.0000";
  const balanced =
    !!preview.data && Number(totalDebit) === Number(totalCredit) && Number(totalDebit) > 0;
  const empty = !preview.isLoading && !preview.isError && lines.length === 0 && !configGap;

  async function onPostConfirm() {
    if (!online) {
      setBanner("You're offline. The opening journal wasn't posted.");
      return;
    }
    setBusy(true);
    try {
      const result = await post.mutateAsync({
        voucherDate: uiDateToApi(voucherDate),
        narration: narration.trim() || null,
      });
      setPostOpen(false);
      toast(`Opening journal posted — ${result.entryNo ?? ""}.`, "success");
      // The `existing` refetch will pick up the new voucher; force it.
      existing.refetch();
    } catch (err) {
      setPostOpen(false);
      const e = asApiError(err);
      if (e.code === "OPENING_ALREADY_EXISTS") {
        setBanner("Another user posted the opening journal in the meantime. The recap will load in a moment.");
        existing.refetch();
      } else {
        setBanner(mapJournalError(e.code));
      }
    } finally {
      setBusy(false);
    }
  }
  function setBusy(v: boolean) { setPosting(v); }

  const step: 1 | 2 = postOpen ? 2 : 1;

  return (
    <div className="mx-auto max-w-4xl pb-24" data-testid="opening-wizard">
      <Breadcrumb items={[{ label: "Contra & Journal" }, { label: "Opening journal" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="opening-title">
          Opening journal
        </h1>
        <span className="inline-flex h-[22px] items-center rounded-pill bg-accent-soft px-2.5 text-[11.5px] font-semibold text-accent-ink" data-testid="opening-step-pill">
          {step === 1 ? "Step 1 · Review" : "Step 2 · Confirm"}
        </span>
      </div>
      <p className="-mt-2 mb-4 text-[13px] text-muted-foreground">
        Post every opening balance from Master Data as a single balanced voucher — once per company.
      </p>

      <OpeningStepper step={step} />

      {!online && (
        <Alert tone="warning" title="You're offline." className="mb-4" data-testid="opening-offline">
          <span className="text-[12.5px]">
            <WifiOff className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Post is disabled until you reconnect.
          </span>
        </Alert>
      )}

      {banner && <Alert tone="destructive" title={banner} className="mb-4" data-testid="opening-banner" />}

      <OneTimeActionNotice />

      {configGap && (
        <Alert
          tone="destructive"
          title="The AR control, AP control, or opening-balance-equity account isn&rsquo;t configured yet."
          className="mt-4"
          data-testid="opening-config-gap"
        >
          <span className="text-[12.5px] font-semibold text-destructive-ink">
            Contact your system administrator before posting opening balances.
          </span>
        </Alert>
      )}

      <Card className="mt-4 p-5" data-testid="opening-header-card">
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <div>
            <Label htmlFor="opening-date">Voucher date</Label>
            <DatePickerInput
              id="opening-date"
              value={voucherDate}
              onChange={setVoucherDate}
              disabled={configGap || posting}
            />
          </div>
          <div>
            <Label htmlFor="opening-narration">Narration</Label>
            <Textarea
              id="opening-narration"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              disabled={configGap || posting}
              rows={2}
              className="min-h-[64px] resize-none"
              data-testid="opening-narration"
            />
          </div>
        </div>
      </Card>

      {empty ? (
        <Card className="mt-4 p-8" data-testid="opening-empty">
          <EmptyState
            icon={Inbox}
            title="Nothing to post yet"
            description="No opening balances to post yet. Enter opening balances on the account and party masters, then come back here to post them to the ledger."
            action={
              <Button size="md" asChild>
                <Link href="/master-data/chart-of-accounts">
                  <Plus className="h-4 w-4" aria-hidden />
                  Go to Master Data
                </Link>
              </Button>
            }
          />
        </Card>
      ) : preview.isError ? (
        <Card className="mt-4 p-8" data-testid="opening-error">
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load the opening balances."
            action={
              <Button size="md" onClick={() => preview.refetch()} data-testid="opening-retry">
                Retry
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="mt-4">
          <OpeningLinesReviewTable
            lines={lines}
            totalDebit={totalDebit}
            totalCredit={totalCredit}
            balanced={balanced}
          />
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-3 shadow-lg lg:pl-[var(--sidebar-w,0)]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
          {configGap ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-muted px-3 py-1 text-[12px] font-semibold text-muted-foreground" data-testid="opening-balanced-unavailable">
              Can&rsquo;t check — accounts not configured
            </span>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[12px] font-semibold",
                balanced ? "bg-success-soft text-success-ink" : "bg-muted text-muted-foreground",
              )}
              data-testid={balanced ? "opening-footer-balanced-ok" : "opening-footer-balanced-pending"}
            >
              {balanced ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
              {balanced ? "Balanced ✓" : "Σ Dr = Σ Cr, server-checked at post."}
            </span>
          )}
          {!empty && !configGap && <span className="text-[12.5px] text-muted-foreground">{lines.length} line{lines.length === 1 ? "" : "s"}</span>}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="md" asChild data-testid="opening-cancel">
              <Link href="/contra-journal/vouchers">Cancel</Link>
            </Button>
            <Button
              size="md"
              onClick={() => setPostOpen(true)}
              disabled={
                configGap ||
                !online ||
                posting ||
                empty ||
                !balanced ||
                !preview.data ||
                !voucherDate ||
                !!existing.data
              }
              className="gap-1.5"
              data-testid="opening-post"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
              Post opening journal
            </Button>
          </div>
        </div>
      </div>

      {posting && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-canvas/60 pt-32" role="alertdialog" aria-modal="true" data-testid="opening-posting-overlay">
          <div className="flex items-center gap-3 rounded-card border border-info-soft bg-surface px-5 py-4 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-info" aria-hidden />
            <div>
              <div className="text-[13.5px] font-bold text-info">Posting the opening journal…</div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">This may take a moment.</div>
            </div>
          </div>
        </div>
      )}

      <OpeningPostDialog
        open={postOpen}
        totalDebit={totalDebit}
        busy={posting}
        onConfirm={onPostConfirm}
        onCancel={() => setPostOpen(false)}
      />
    </div>
  );
}

/** Two-segment step progress (spec §4/§6; design "Opening Journal.dc.html" header). */
function OpeningStepper({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-4 flex overflow-hidden rounded-card border border-border bg-surface" data-testid="opening-stepper">
      <StepSegment n={1} label="Review opening balances" active={step === 1} done={step > 1} />
      <StepSegment n={2} label="Confirm & post" active={step === 2} done={false} />
    </div>
  );
}

function StepSegment({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={cn("flex flex-1 items-center gap-3 px-4 py-3", active && "bg-accent-soft/40")}>
      <span
        className={cn(
          "grid h-6 w-6 flex-none place-items-center rounded-full text-[12px] font-bold",
          done ? "bg-success text-success-foreground" : active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </span>
      <div className="min-w-0">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Step {n}</div>
        <div className={cn("text-[13px] font-semibold", active ? "text-foreground" : "text-muted-foreground")}>{label}</div>
      </div>
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumb items={[{ label: "Contra & Journal" }, { label: "Opening journal" }]} />
      <div className="mb-4 mt-1">
        <Skeleton className="h-7 w-56" />
      </div>
      <Card className="p-5" data-testid="opening-loading">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="mb-2 h-9 w-full" />)}
      </Card>
    </div>
  );
}

function defaultToday(): string {
  const d = new Date();
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function uiDateToApi(v: string): string {
  const d = parseDate(v);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
