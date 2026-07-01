/**
 * FE-19 project-assignment unit tests (FR-AUD-014/015/020). Covers the
 * `projectIds` set validation (non-empty, client dedupe) and the server-error
 * mapping (spec §8 exact strings) — the two schema-level building blocks the
 * screen composes into the batched replace-set save.
 */
import { ApiError } from "@/lib/api/errors";
import {
  EMPTY_SELECTION_MESSAGE,
  dedupeProjectIds,
  isEmptySelection,
  projectIdsSchema,
  mapProjectAssignmentError,
  ASSIGNMENT_LOAD_ERROR_MESSAGE,
  ASSIGNMENT_SCOPE_CLASH_MESSAGE,
  ASSIGNMENT_NOT_FOUND_MESSAGE,
  ASSIGNMENT_FORBIDDEN_MESSAGE,
  ASSIGNMENT_OFFLINE_MESSAGE,
} from "@/features/audit/schemas/project-assignment";

describe("dedupeProjectIds (spec §6 — duplicates deduped client-side)", () => {
  it("removes duplicate ids, preserving first-seen order", () => {
    expect(dedupeProjectIds(["p1", "p2", "p1", "p3", "p2"])).toEqual(["p1", "p2", "p3"]);
  });

  it("returns an empty array unchanged", () => {
    expect(dedupeProjectIds([])).toEqual([]);
  });

  it("leaves an already-unique list unchanged", () => {
    expect(dedupeProjectIds(["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("isEmptySelection / projectIdsSchema (SRS §11 — >= 1 project to transact)", () => {
  it("treats an empty array as an empty selection", () => {
    expect(isEmptySelection([])).toBe(true);
  });

  it("treats an array that dedupes to empty as an empty selection", () => {
    expect(isEmptySelection([])).toBe(true);
  });

  it("treats a non-empty array as not empty", () => {
    expect(isEmptySelection(["p1"])).toBe(false);
  });

  it("projectIdsSchema rejects an empty array with the exact spec §8 message", () => {
    const result = projectIdsSchema.safeParse([]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(EMPTY_SELECTION_MESSAGE);
    }
    expect(EMPTY_SELECTION_MESSAGE).toBe("Select at least one project.");
  });

  it("projectIdsSchema accepts and dedupes a non-empty array", () => {
    const result = projectIdsSchema.safeParse(["p1", "p1", "p2"]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(["p1", "p2"]);
    }
  });
});

describe("mapProjectAssignmentError (spec §8 exact strings)", () => {
  const of = (code: string) => new ApiError({ code, message: "x", details: null, status: 409 });

  it("maps VALIDATION_ERROR to the exact empty-selection copy", () => {
    const m = mapProjectAssignmentError(of("VALIDATION_ERROR"));
    expect(m.kind).toBe("validation");
    expect(m.message).toBe(EMPTY_SELECTION_MESSAGE);
  });

  it("maps ROLE_SCOPE_CONFLICT to the exact unscoped-clash copy", () => {
    const m = mapProjectAssignmentError(of("ROLE_SCOPE_CONFLICT"));
    expect(m.kind).toBe("roleScopeConflict");
    expect(m.message).toBe(ASSIGNMENT_SCOPE_CLASH_MESSAGE);
    expect(m.message).toBe(
      "This role applies to all projects, so individual projects can't be assigned.",
    );
  });

  it("maps NOT_FOUND to the exact missing-project copy", () => {
    const m = mapProjectAssignmentError(of("NOT_FOUND"));
    expect(m.kind).toBe("notFound");
    expect(m.message).toBe(ASSIGNMENT_NOT_FOUND_MESSAGE);
    expect(m.message).toBe("That project no longer exists in this company.");
  });

  it("maps FORBIDDEN to the exact 403 copy", () => {
    const m = mapProjectAssignmentError(of("FORBIDDEN"));
    expect(m.message).toBe(ASSIGNMENT_FORBIDDEN_MESSAGE);
    expect(m.message).toBe("You don't have access to project assignment.");
  });

  it("maps NETWORK_ERROR to the exact offline copy", () => {
    const m = mapProjectAssignmentError(of("NETWORK_ERROR"));
    expect(m.kind).toBe("offline");
    expect(m.message).toBe(ASSIGNMENT_OFFLINE_MESSAGE);
  });

  it("falls back to the load-error copy for an unknown code with no message", () => {
    const m = mapProjectAssignmentError(
      new ApiError({ code: "UNKNOWN", message: "", details: null, status: 500 }),
    );
    expect(m.kind).toBe("unknown");
    expect(m.message).toBe(ASSIGNMENT_LOAD_ERROR_MESSAGE);
  });
});
