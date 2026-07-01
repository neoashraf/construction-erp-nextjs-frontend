/**
 * FE-16 change-password — zod schema + strength/policy helper unit tests
 * (SRS §11/§16: min 10 chars + letters & numbers; no reuse/history rule).
 */
import {
  changePasswordSchema,
  hasLetterAndNumber,
  hasMinLength,
  PASSWORD_MIN_LENGTH,
} from "@/features/audit/schemas/change-password";
import { estimateStrength, policyChecklist } from "@/features/audit/lib/password-strength";

describe("changePasswordSchema", () => {
  it("requires a non-empty current password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "",
      newPassword: "Buriganga2026",
      confirmPassword: "Buriganga2026",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "Enter your current password.")).toBe(true);
    }
  });

  it("rejects a new password shorter than 10 characters", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "old",
      newPassword: "short1",
      confirmPassword: "short1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === "Password must be at least 10 characters."),
      ).toBe(true);
    }
  });

  it("rejects a new password missing letters or numbers", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "old",
      newPassword: "aaaaaaaaaa",
      confirmPassword: "aaaaaaaaaa",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === "Password must include letters and numbers."),
      ).toBe(true);
    }
  });

  it("rejects a mismatched confirm password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "old",
      newPassword: "Buriganga2026",
      confirmPassword: "Different2026",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "Passwords don't match.")).toBe(true);
    }
  });

  it("accepts a policy-compliant, matching password pair", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "old",
      newPassword: "Buriganga2026",
      confirmPassword: "Buriganga2026",
    });
    expect(result.success).toBe(true);
  });
});

describe("password policy helpers", () => {
  it("hasMinLength honours PASSWORD_MIN_LENGTH", () => {
    expect(hasMinLength("a".repeat(PASSWORD_MIN_LENGTH - 1))).toBe(false);
    expect(hasMinLength("a".repeat(PASSWORD_MIN_LENGTH))).toBe(true);
  });

  it("hasLetterAndNumber requires both a letter and a digit", () => {
    expect(hasLetterAndNumber("onlyletters")).toBe(false);
    expect(hasLetterAndNumber("12345678")).toBe(false);
    expect(hasLetterAndNumber("letters123")).toBe(true);
  });
});

describe("estimateStrength", () => {
  it("returns score 0 / '—' for an empty password", () => {
    expect(estimateStrength("")).toEqual({ score: 0, label: "—" });
  });

  it("rates a short simple password as Weak", () => {
    expect(estimateStrength("abcdefg").label).toBe("Weak");
  });

  it("rates a long mixed-case+digit password as Good or Strong", () => {
    const { label } = estimateStrength("Buriganga2026");
    expect(["Good", "Strong"]).toContain(label);
  });
});

describe("policyChecklist", () => {
  it("marks both rows unmet for an empty password", () => {
    const items = policyChecklist("");
    expect(items.find((i) => i.id === "length")?.met).toBe(false);
    expect(items.find((i) => i.id === "complexity")?.met).toBe(false);
  });

  it("marks both rows met for a compliant password", () => {
    const items = policyChecklist("Buriganga2026");
    expect(items.every((i) => i.met)).toBe(true);
  });

  it("never includes a reuse/history row (SRS §16 — none in Phase 1)", () => {
    const items = policyChecklist("Buriganga2026");
    expect(items.some((i) => /reuse|history|differ/i.test(i.label))).toBe(false);
  });
});
