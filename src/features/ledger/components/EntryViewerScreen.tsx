"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Lock, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { asApiError } from "@/lib/api/errors";
import { useJournalEntry } from "../hooks/useJournalEntry";
import { EntryHeaderBlock } from "./EntryHeaderBlock";
import { EntryLinesTable, EntryLinesCards } from "./EntryLinesTable";
import { EntryTotalsFooter } from "./EntryTotalsFooter";
import { EntryLinkagePanel } from "./EntryLinkagePanel";
import { EntryViewerSkeleton } from "./EntryViewerSkeleton";

/** Track the browser's online/offline status (spec §6 offline banner). */
function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    set();
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => {
      window.removeEventListener("online", set);
      window.removeEventListener("offline", set);
    };
  }, []);
  return online;
}

/**
 * Entry viewer — the read-only detail screen for one posted journal entry (FR-LED-005
 * /006/030/026/024/007; spec 02-ledger/entry-viewer.md). Opens from the Journal
 * entries list / Account ledger row, or by deep-link (`?id=`); binds
 * `GET /api/ledger/entries/{id}`. STRICTLY READ-ONLY: no edit/delete/void/post control
 * for any role — the immutability note is text only (FR-LED-024). Full state matrix
 * (spec §6): default/loaded · loading (skeleton) · partial (unresolved names handled
 * inline by each field) · error+retry · 404 · 403 permission-denied · offline; there
 * is no empty state (a fetched entry always has ≥2 lines) and no saving/posting state.
 */
export function EntryViewerScreen({ id, fyLabel = "Active FY" }: { id: string | null; fyLabel?: string }) {
  const router = useRouter();
  const online = useOnline();
  const query = useJournalEntry(id);
  const entry = query.data;

  const err = query.isError ? asApiError(query.error) : null;
  const notFound = err?.code === "NOT_FOUND" || err?.status === 404;
  const forbidden = err?.code === "FORBIDDEN" || err?.status === 403;
  const otherError = query.isError && !notFound && !forbidden;

  function goBack() {
    router.push("/ledger/journal-entries");
  }

  // Malformed / missing id — same "doesn't exist" 404 view (spec §6).
  if (id === null) {
    return <NotFoundView onBack={goBack} />;
  }

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb entryNo="…" />
        <EntryViewerSkeleton />
      </div>
    );
  }

  if (notFound) {
    return <NotFoundView onBack={goBack} />;
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-6xl" data-testid="entry-forbidden">
        <Breadcrumb entryNo={id} />
        <Card className="mt-4 p-8">
          <EmptyState
            icon={Lock}
            title="You don't have access to this entry."
            description="If you're a project manager, you can only view entries that touch your assigned projects."
            action={
              <Button size="md" variant="outline" onClick={goBack}>
                Back to entries
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  if (otherError) {
    return (
      <div className="mx-auto max-w-6xl" data-testid="entry-error">
        <Breadcrumb entryNo={id} />
        <Card className="mt-4 p-8">
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load this entry. Please try again."
            description="Check your connection and retry."
            action={
              <Button size="md" onClick={() => query.refetch()} data-testid="entry-retry">
                Retry
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  if (!entry) {
    // Defensive fallback — the query resolved with no data and no error classification.
    return <NotFoundView onBack={goBack} />;
  }

  return (
    <div className="mx-auto max-w-6xl" data-testid="entry-viewer-loaded">
      <Breadcrumb entryNo={entry.entryNo} />

      <div className="flex flex-wrap items-start gap-4">
        <h1 className="text-[23px] font-bold tracking-[-0.02em] text-foreground">
          Journal entry <span className="font-mono">{entry.entryNo}</span>
        </h1>
        <div className="ml-auto flex gap-2.5">
          <Button variant="outline" onClick={goBack}>
            Back to entries
          </Button>
          {entry.sourceType && entry.sourceId && (
            <Button
              variant="ghost"
              onClick={() => router.push(`/vouchers/${entry.sourceType!.toLowerCase()}/${entry.sourceId}`)}
            >
              View source voucher
            </Button>
          )}
        </div>
      </div>

      {!online && (
        <Alert tone="warning" title="You're offline." className="mt-3" data-testid="entry-offline">
          Showing the last loaded entry. Linkage navigation that needs a fetch is disabled until you reconnect.
        </Alert>
      )}

      <EntryHeaderBlock entry={entry} fyLabel={fyLabel} />

      <Card className="mt-4 overflow-hidden">
        <EntryLinesTable lines={entry.lines} />
        <EntryLinesCards lines={entry.lines} />
        <EntryTotalsFooter totalDebit={entry.totalDebit} totalCredit={entry.totalCredit} />
      </Card>

      <EntryLinkagePanel entry={entry} />
    </div>
  );
}

function NotFoundView({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto max-w-6xl" data-testid="entry-not-found">
      <Breadcrumb />
      <Card className="mt-4 p-8">
        <EmptyState
          icon={Search}
          title="Entry not found"
          description="This entry doesn't exist or isn't in your company."
          action={
            <Button size="md" onClick={onBack}>
              Back to entries
            </Button>
          }
        />
      </Card>
    </div>
  );
}

function Breadcrumb({ entryNo }: { entryNo?: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-1.5 text-xs text-muted-foreground">
      Ledger <span className="text-border-strong">/</span>{" "}
      {entryNo ? (
        <>
          <span className="text-border-strong">Journal entries</span> <span className="text-border-strong">/</span>{" "}
          <span className="font-mono font-medium text-foreground">{entryNo}</span>
        </>
      ) : (
        <span className="font-medium text-foreground">Journal entries</span>
      )}
    </nav>
  );
}
