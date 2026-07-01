import { Link2 } from "lucide-react";

/**
 * The per-entry tamper-evidence seal — DISPLAY ONLY (FR-AUD-024; SRS §16;
 * open-questions AUD-2). There is intentionally NO "Verify integrity" control and
 * NO broken-seal state anywhere in this component or its caller — chain
 * verification is an out-of-band operational job in Phase 1. The full hash
 * renders unclipped (`break-all`), never truncated.
 */
export function SealDisplay({ seal }: { seal: string }) {
  return (
    <div className="border-t border-border pt-3.5" data-testid="seal-display">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-4 w-4 place-items-center rounded-full bg-success-soft text-success-ink">
          <Link2 className="h-2.5 w-2.5" aria-hidden />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Tamper-evidence seal
        </span>
      </div>
      <div className="flex items-start gap-2 rounded-token border border-border bg-surface-2 px-3 py-2.5">
        <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-foreground">
          {seal}
        </code>
      </div>
      <p className="mt-1.5 text-[10.5px] text-faint">
        Recorded for evidence. Chain verification runs out-of-band.
      </p>
    </div>
  );
}
