"use client";

import { AlertCircle, ArrowLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { asApiError } from "@/lib/api/errors";
import { useOnline } from "@/lib/hooks/use-online";
import { useIpc } from "../hooks/useIpc";
import { useMushakRefs } from "../hooks/useMushakPrint";
import { MushakPrintPreview } from "./MushakPrintPreview";

/**
 * Route-level composer for the Mushak print preview (spec §6 print states). Owns:
 *  - the IPC read (`sales.ipcs:READ`) — 404/403/error/offline surfaces;
 *  - the company + customer party reads for the statutory document;
 *  - the "Preparing the IPC document…" loading state;
 *  - the "Couldn't generate the IPC document." + Retry generation-failure state (
 *    surfaces if either the company or the party read fails without a 404 — a partial
 *    read where BIN/TIN is null shows "Not on file" in-place, not this banner).
 * The PDF endpoint doesn't yet exist (brief G2 — RPT dependency); this on-screen
 * preview + `window.print()` ships now, the PDF wires in when RPT lands.
 */
export function MushakPrintPreviewScreen({ ipcId }: { ipcId: string }) {
  const router = useRouter();
  const online = useOnline();
  const ipcQuery = useIpc(ipcId);
  const ipc = ipcQuery.data;

  const err = ipcQuery.isError ? asApiError(ipcQuery.error) : null;
  const notFound = err?.code === "NOT_FOUND" || err?.status === 404;
  const forbidden = err?.code === "FORBIDDEN" || err?.status === 403;
  const otherError = ipcQuery.isError && !notFound && !forbidden;

  const { company, party } = useMushakRefs(ipc?.customerId ?? null);
  const generationError =
    (company.isError && !isNotFound(company.error)) ||
    (party.isError && !isNotFound(party.error))
      ? "The IPC data loaded but the statutory identifiers couldn't be resolved. Retry to try again."
      : null;

  if (ipcQuery.isLoading) {
    return (
      <div className="min-h-screen bg-sidebar-hover p-8" data-testid="mushak-loading">
        <div className="mx-auto flex max-w-[720px] items-center gap-3 text-white">
          <Skeleton className="h-4 w-56 bg-sidebar-border" />
        </div>
        <div className="mx-auto mt-4 max-w-[720px] bg-white p-10">
          <Skeleton className="h-6 w-40" />
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <div className="mt-6 flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
          <p className="mt-4 text-center text-[12px] text-muted-foreground">Preparing the IPC document…</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <PrintShell>
        <Card className="mx-auto mt-16 max-w-md p-10">
          <EmptyState
            icon={Search}
            title="IPC not found"
            description="This IPC doesn't exist or isn't in your company, so there's no document to print."
            action={
              <Button size="md" onClick={() => window.close()}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Close
              </Button>
            }
          />
        </Card>
      </PrintShell>
    );
  }

  if (forbidden) {
    return (
      <PrintShell>
        <Card className="mx-auto mt-16 max-w-md p-10">
          <EmptyState
            icon={AlertCircle}
            title="You don't have access to this IPC."
            description="Ask your Accounts team to run the print for you."
            action={
              <Button size="md" variant="outline" onClick={() => window.close()}>
                Close
              </Button>
            }
          />
        </Card>
      </PrintShell>
    );
  }

  if (otherError || !ipc) {
    return (
      <PrintShell>
        <Card className="mx-auto mt-16 max-w-md p-10">
          <EmptyState
            icon={AlertCircle}
            title="Couldn't generate the IPC document."
            description={online ? "Please retry." : "You're offline. The IPC document couldn't be generated."}
            action={
              <Button size="md" onClick={() => ipcQuery.refetch()} data-testid="mushak-retry" disabled={!online}>
                Retry
              </Button>
            }
          />
        </Card>
      </PrintShell>
    );
  }

  return (
    <MushakPrintPreview
      ipc={ipc}
      company={company.data}
      party={party.data}
      companyLoading={company.isLoading}
      partyLoading={party.isLoading}
      error={generationError}
      onClose={() => (typeof window !== "undefined" ? window.close() : router.back())}
    />
  );
}

function PrintShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-sidebar-hover p-8">{children}</div>;
}

function isNotFound(e: unknown): boolean {
  const err = asApiError(e);
  return err.code === "NOT_FOUND" || err.status === 404;
}
