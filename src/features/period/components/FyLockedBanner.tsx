import { Lock } from "lucide-react";
import { Alert } from "@/components/ui/alert";

/**
 * FY-locked banner (spec §5/§6/§8): shown when every period of the selected FY
 * is CLOSED. Close-all is hidden/disabled alongside this (screen wires that).
 * `role="alert"` comes from the shared `Alert` primitive (spec §10 a11y).
 */
export function FyLockedBanner() {
  return (
    <Alert tone="warning" title="This financial year is locked — all periods are closed.">
      <span className="flex items-center gap-1.5">
        <Lock className="h-3.5 w-3.5" aria-hidden />
        Reopen a period to post corrections.
      </span>
    </Alert>
  );
}
