import { AlertOctagon } from "lucide-react";

/**
 * Persistent one-time-action notice for the opening wizard (spec §8; FR-GEN-012).
 * Load-bearing safety copy — kept in normal reading/focus order, not tooltip-only.
 */
export function OneTimeActionNotice() {
  return (
    <div
      className="flex items-start gap-3 rounded-card border border-warning-soft bg-warning-soft/40 p-3.5"
      data-testid="opening-one-time-action-notice"
      role="note"
    >
      <AlertOctagon className="mt-0.5 h-4.5 w-4.5 flex-none text-warning-ink" aria-hidden />
      <p className="text-[12.5px] leading-relaxed text-foreground">
        <strong className="font-semibold text-warning-ink">This can be posted only once per company.</strong>{" "}
        Review every line carefully — once posted, corrections are made by reversing and
        reposting this same opening journal, not by posting a second one.
      </p>
    </div>
  );
}
