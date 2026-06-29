import { sampleSchema, mapValidationDetails } from "@/lib/forms/sample-schema";

describe("sample form schema (RHF+zod reference pattern)", () => {
  it("accepts valid input", () => {
    const r = sampleSchema.safeParse({ name: "Acme", phone: "+8801712345678", amount: "1000.5000" });
    expect(r.success).toBe(true);
  });

  it("rejects a non-E.164 phone", () => {
    const r = sampleSchema.safeParse({ name: "Acme", phone: "01712345678", amount: "1" });
    expect(r.success).toBe(false);
  });

  it("rejects money with more than 4 decimals (scale guard, no float)", () => {
    const r = sampleSchema.safeParse({ name: "Acme", phone: "+8801712345678", amount: "1.23456" });
    expect(r.success).toBe(false);
  });

  it("maps a server VALIDATION_ERROR details object onto fields", () => {
    expect(
      mapValidationDetails({ email: "must be unique", phone: "invalid" }),
    ).toEqual([
      { field: "email", message: "must be unique" },
      { field: "phone", message: "invalid" },
    ]);
    expect(mapValidationDetails(null)).toEqual([]);
  });
});
