import { cn } from "@/lib/utils";
import { AUDIT_ACTION_TONE, type AuditActionTone } from "../types";

/**
 * The audit-log action badge (design file — per-action tones; spec §5/§10). A
 * coloured dot + bold uppercase text label — never colour alone (a11y, spec §10).
 * Tones map through the shared design-system tone tokens (never raw hex):
 * positive (CREATE/APPROVE/ACTIVATE) · info (UPDATE) · negative (DELETE/REJECT) ·
 * brand (POST — the lime accent) · warning (CANCEL/DEACTIVATE).
 */
const TONE_CLASSES: Record<AuditActionTone, { bg: string; text: string; dot: string }> = {
  positive: { bg: "bg-success-soft", text: "text-success-ink", dot: "bg-success" },
  info: { bg: "bg-info-soft", text: "text-info-ink", dot: "bg-info" },
  negative: { bg: "bg-destructive-soft", text: "text-destructive-ink", dot: "bg-destructive" },
  brand: { bg: "bg-accent-soft", text: "text-accent-ink", dot: "bg-accent" },
  warning: { bg: "bg-warning-soft", text: "text-warning-ink", dot: "bg-warning" },
};

export function ActionBadge({ action, className }: { action: string; className?: string }) {
  const tone = AUDIT_ACTION_TONE[action as keyof typeof AUDIT_ACTION_TONE] ?? "info";
  const cls = TONE_CLASSES[tone];
  return (
    <span
      className={cn(
        "inline-flex h-[23px] items-center gap-1.5 rounded-pill px-2.5 text-[11px] font-bold uppercase tracking-wide",
        cls.bg,
        cls.text,
        className,
      )}
      data-testid={`action-badge-${action}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", cls.dot)} aria-hidden />
      {action}
    </span>
  );
}
