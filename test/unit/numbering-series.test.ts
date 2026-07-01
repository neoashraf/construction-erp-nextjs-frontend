/**
 * FE-14 numbering-series unit tests (FR-NUM-002/013/018).
 * The zod editor schema, the client-side preview composition (never clipped past
 * the padding width), and the server-error → field/message mapping.
 */
import { ApiError } from "@/lib/api/errors";
import {
  seriesEditSchema,
  zeroPad,
  composePreview,
  fyLabelFromPreview,
  mapSeriesEditError,
} from "@/features/numbering/schemas/numbering-series.schema";

describe("seriesEditSchema", () => {
  it("accepts a safe prefix + padding ≥ 1", () => {
    const r = seriesEditSchema.safeParse({ prefix: "IPC-A", paddingWidth: 4 });
    expect(r.success).toBe(true);
  });

  it("rejects an empty prefix with the exact message", () => {
    const r = seriesEditSchema.safeParse({ prefix: "  ", paddingWidth: 4 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message)).toContain("Enter a prefix.");
  });

  it("rejects a prefix containing '/'", () => {
    const r = seriesEditSchema.safeParse({ prefix: "IPC/A", paddingWidth: 4 });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error.issues.map((i) => i.message)).toContain(
        "Use only letters, digits and - _ — no /.",
      );
  });

  it("rejects paddingWidth < 1", () => {
    const r = seriesEditSchema.safeParse({ prefix: "IPC", paddingWidth: 0 });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error.issues.map((i) => i.message)).toContain("Padding width must be at least 1.");
  });

  it("coerces a numeric-string paddingWidth from the input", () => {
    const r = seriesEditSchema.safeParse({ prefix: "IPC", paddingWidth: "5" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.paddingWidth).toBe(5);
  });
});

describe("zeroPad — never clipped past the width (SRS §11 EC8)", () => {
  it("pads shorter sequences", () => {
    expect(zeroPad(42, 4)).toBe("0042");
    expect(zeroPad(1, 4)).toBe("0001");
  });
  it("renders longer sequences at FULL length (no clipping)", () => {
    expect(zeroPad(10000, 4)).toBe("10000");
    expect(zeroPad(123456, 4)).toBe("123456");
  });
});

describe("composePreview + fyLabelFromPreview", () => {
  it("composes <prefix>/<fyLabel>/<padded seq>", () => {
    expect(composePreview("IPC", 4, 42, "2526")).toBe("IPC/2526/0042");
  });
  it("extracts the FY-label segment from a server preview", () => {
    expect(fyLabelFromPreview("IPC/2526/0042")).toBe("2526");
    expect(fyLabelFromPreview("")).toBe("");
    expect(fyLabelFromPreview(undefined)).toBe("");
  });
  it("full-length preview when the sequence exceeds padding", () => {
    expect(composePreview("DLA", 4, 10000, "2526")).toBe("DLA/2526/10000");
  });
});

describe("mapSeriesEditError (spec §8)", () => {
  const of = (code: string, details?: Record<string, unknown> | null) =>
    new ApiError({ code, message: "x", details: details ?? null, status: 400 });

  it("maps VALIDATION_ERROR details onto the field", () => {
    const m = mapSeriesEditError(of("VALIDATION_ERROR", { paddingWidth: "Padding width must be at least 1." }));
    expect(m.fieldErrors.paddingWidth).toBe("Padding width must be at least 1.");
  });

  it("maps IMMUTABLE_FIELD to the last-sequence read-only message", () => {
    const m = mapSeriesEditError(of("IMMUTABLE_FIELD"));
    expect(m.formMessage).toBe(
      "Last sequence can't be edited — it advances only when a voucher posts.",
    );
  });

  it("maps NETWORK_ERROR to the offline message", () => {
    const m = mapSeriesEditError(of("NETWORK_ERROR"));
    expect(m.formMessage).toBe("You're offline. Changes weren't saved.");
  });

  it("maps SERIES_ALREADY_EXISTS to the duplicate-triple message", () => {
    const m = mapSeriesEditError(of("SERIES_ALREADY_EXISTS"));
    expect(m.formMessage).toContain("already exists");
  });
});
