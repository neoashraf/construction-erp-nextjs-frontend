import { cn } from "@/lib/utils";
import { type PasswordStrength } from "../types";

const BAR_COLOR: Record<PasswordStrength["score"], string> = {
  0: "bg-border",
  1: "bg-destructive",
  2: "bg-warning",
  3: "bg-success",
  4: "bg-success",
};

const LABEL_COLOR: Record<PasswordStrength["score"], string> = {
  0: "text-faint",
  1: "text-destructive-ink",
  2: "text-warning-ink",
  3: "text-success-ink",
  4: "text-success-ink",
};

interface StrengthMeterProps {
  strength: PasswordStrength;
}

/**
 * Live password-strength meter (spec §5/§9/§10). Advisory only. Conveys level by
 * TEXT + colour (not colour alone — a11y §10): the numeric label is always
 * visible alongside the coloured bars, and each bar segment has an
 * `aria-hidden` decorative role while the text label carries the semantics.
 */
export function StrengthMeter({ strength }: StrengthMeterProps) {
  return (
    <div className="mt-[3px] flex flex-col gap-[6px]" data-testid="strength-meter">
      <div className="flex gap-[5px]" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "h-[5px] flex-1 rounded-pill",
              i <= strength.score ? BAR_COLOR[strength.score] : "bg-border",
            )}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-faint">Password strength</span>
        <span className={cn("text-[11.5px] font-semibold", LABEL_COLOR[strength.score])}>
          {strength.label}
        </span>
      </div>
    </div>
  );
}
