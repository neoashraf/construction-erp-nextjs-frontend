import { type PasswordStrength, type PolicyChecklistItem } from "../types";
import { hasLetterAndNumber, hasMinLength } from "../schemas/change-password";

/**
 * Client-side strength estimate (spec §5/§9 — advisory only, mirrors the design
 * file's `strength()` heuristic). The server policy is authoritative; this only
 * drives the live meter as the user types.
 */
export function estimateStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "—" };
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) s += 1;
  const score = Math.max(1, Math.min(4, s)) as 1 | 2 | 3 | 4;
  const labels: Record<1 | 2 | 3 | 4, PasswordStrength["label"]> = {
    1: "Weak",
    2: "Fair",
    3: "Good",
    4: "Strong",
  };
  return { score, label: labels[score] };
}

/** Live policy checklist rows (spec §5/§6/§8 — SRS §16: min 10 + letters & numbers). */
export function policyChecklist(pw: string): PolicyChecklistItem[] {
  return [
    { id: "length", label: "At least 10 characters", met: hasMinLength(pw) },
    { id: "complexity", label: "Letters and numbers", met: hasLetterAndNumber(pw) },
  ];
}
