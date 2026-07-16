import { cn } from "@/lib/utils";

const STEPS = ["Draft", "Posted", "Cancelled"] as const;
type Step = (typeof STEPS)[number];

/**
 * Draft → Posted (→ Cancelled) lifecycle stepper (design file `Receipt Editor.dc.html`
 * frame 1; CLAUDE.md "draft → posted lifecycle"). Purely a status readout — the
 * receipt's lifecycle only ever advances via Post/Cancel elsewhere; this never
 * accepts a click.
 */
export function ReceiptLifecycleStepper({ current }: { current: Step }) {
  const currentIndex = STEPS.indexOf(current);
  return (
    <ol className="flex items-center gap-2" aria-label="Receipt lifecycle" data-testid="receipt-lifecycle-stepper">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={step} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-6 bg-border-strong" aria-hidden />}
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold",
                active || done
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-faint",
              )}
              aria-hidden
            >
              {i + 1}
            </span>
            <span
              className={cn(
                "text-[13px] font-semibold",
                active ? "text-foreground" : "text-faint",
              )}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
