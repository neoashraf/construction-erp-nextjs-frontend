"use client";

import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * FE-57 shared body-state renderers (spec §6). The five per-report tables
 * share the same loading skeletons / empty / error scaffolding, and only
 * their column set differs.
 */
export function LoadingBody({ testid, rows = 8 }: { testid: string; rows?: number }) {
  return (
    <div className="p-6" data-testid={testid}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="mb-2 h-8 w-full" />
      ))}
    </div>
  );
}

export function ErrorBody({
  title,
  onRetry,
  testid,
  retryTestid,
}: {
  title: string;
  onRetry: () => void;
  testid: string;
  retryTestid: string;
}) {
  return (
    <div className="p-8" data-testid={testid}>
      <EmptyState
        icon={AlertCircle}
        title={title}
        description="Your parameters are preserved — try Run again."
        action={
          <Button size="md" onClick={onRetry} data-testid={retryTestid}>
            Retry
          </Button>
        }
      />
    </div>
  );
}

export function IdleBody({ testid }: { testid: string }) {
  return (
    <div className="p-8" data-testid={testid}>
      <EmptyState icon={Inbox} title="Set parameters and select Run." />
    </div>
  );
}

export function EmptyBody({ label, testid }: { label: string; testid: string }) {
  return (
    <div className="p-8" data-testid={testid}>
      <EmptyState icon={Inbox} title={label} />
    </div>
  );
}

/** Partial (name-unavailable) placeholder — mirrors FE-54's NameUnavailable. */
export function NameUnavailable({ id }: { id: string }) {
  return (
    <span className="text-muted-foreground" data-testid="pi-name-unavailable">
      {id}
      <span className="ml-1 text-[10.5px] italic">(name unavailable)</span>
    </span>
  );
}

/** Uniform CC cell — "CC-01 · Materials" or "gone-cc (name unavailable)". */
export function CostCentreCell({
  code,
  name,
  fallbackId,
}: {
  code: string | null;
  name: string | null;
  fallbackId?: string;
}) {
  if (name) {
    return (
      <span className="font-medium">
        {code}
        <span className="mx-1 text-muted-foreground">·</span>
        {name}
      </span>
    );
  }
  return <NameUnavailable id={code ?? fallbackId ?? "—"} />;
}
