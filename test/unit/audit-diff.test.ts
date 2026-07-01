/**
 * FE-20 before/after diff builder unit tests (FR-AUD-022; screen spec §6/§13; SRS
 * §12 edge 8). CREATE -> after-only, DELETE -> before-only, else both sides with
 * per-field changed/unchanged flags.
 */
import { buildAuditDiff, formatDiffValue } from "@/features/audit/lib/diff";

describe("buildAuditDiff — CREATE / DELETE / UPDATE (FR-AUD-022)", () => {
  it("CREATE: before=null -> after-only fields, mode 'create'", () => {
    const diff = buildAuditDiff({ before: null, after: { name: "New Project", status: "ACTIVE" } });
    expect(diff.mode).toBe("create");
    expect(diff.fields.map((f) => f.field).sort()).toEqual(["name", "status"]);
    expect(diff.fields.every((f) => f.changed === false)).toBe(true);
    expect(diff.fields.find((f) => f.field === "name")?.after).toBe("New Project");
    expect(diff.fields.find((f) => f.field === "name")?.before).toBeUndefined();
  });

  it("DELETE: after=null -> before-only fields, mode 'delete'", () => {
    const diff = buildAuditDiff({ before: { name: "Old Project" }, after: null });
    expect(diff.mode).toBe("delete");
    expect(diff.fields[0]?.before).toBe("Old Project");
    expect(diff.fields[0]?.after).toBeUndefined();
  });

  it("UPDATE: both sides populated -> mode 'both', flags changed fields", () => {
    const diff = buildAuditDiff({
      before: { name: "Bridge-04", status: "DRAFT", budget: "1000.0000" },
      after: { name: "Bridge-04", status: "ACTIVE", budget: "1000.0000" },
    });
    expect(diff.mode).toBe("both");
    const status = diff.fields.find((f) => f.field === "status");
    const name = diff.fields.find((f) => f.field === "name");
    const budget = diff.fields.find((f) => f.field === "budget");
    expect(status?.changed).toBe(true);
    expect(name?.changed).toBe(false);
    expect(budget?.changed).toBe(false);
  });

  it("UPDATE: a field present only in after (added) is flagged changed", () => {
    const diff = buildAuditDiff({ before: { a: 1 }, after: { a: 1, b: 2 } });
    const added = diff.fields.find((f) => f.field === "b");
    expect(added?.changed).toBe(true);
    expect(added?.before).toBeUndefined();
    expect(added?.after).toBe(2);
  });

  it("never surfaces password_hash or encrypted fields — trusts the API's sanitisation, doesn't add its own leak", () => {
    // The API contract guarantees sanitised before/after; this only proves the
    // diff builder doesn't invent extra fields beyond what it's given.
    const diff = buildAuditDiff({ before: { name: "x" }, after: { name: "y" } });
    expect(diff.fields.some((f) => f.field === "password_hash")).toBe(false);
  });
});

describe("formatDiffValue", () => {
  it("renders null/undefined as an em-dash", () => {
    expect(formatDiffValue(null)).toBe("—");
    expect(formatDiffValue(undefined)).toBe("—");
  });

  it("renders primitives verbatim", () => {
    expect(formatDiffValue("Active")).toBe("Active");
    expect(formatDiffValue(42)).toBe("42");
    expect(formatDiffValue(true)).toBe("true");
  });

  it("renders an object/array as JSON", () => {
    expect(formatDiffValue({ a: 1 })).toBe('{"a":1}');
  });
});
