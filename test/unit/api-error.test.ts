import { ApiError, toApiError, asApiError, networkError } from "@/lib/api/errors";
import { pageQuery, pageCount, DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";

describe("ApiError — error-envelope mapper", () => {
  it("maps the §6 envelope { error: { code, message, details } } to a typed ApiError", () => {
    const err = toApiError(
      { error: { code: "VALIDATION_ERROR", message: "Bad input", details: { email: "required" } } },
      400,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("Bad input");
    expect(err.details).toEqual({ email: "required" });
    expect(err.status).toBe(400);
    expect(err.isValidation).toBe(true);
  });

  it("exposes the auth helper predicates", () => {
    expect(toApiError({ error: { code: "FORBIDDEN", message: "no" } }, 403).isForbidden).toBe(true);
    expect(toApiError({ error: { code: "TOKEN_EXPIRED", message: "x" } }, 401).isTokenExpired).toBe(true);
  });

  it("falls back to UNKNOWN for a missing/malformed envelope", () => {
    const err = toApiError("plain text body", 500, "Internal Server Error");
    expect(err.code).toBe("UNKNOWN");
    expect(err.message).toBe("Internal Server Error");
    expect(err.status).toBe(500);
  });

  it("builds a NETWORK_ERROR for transport failures", () => {
    const err = networkError();
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.status).toBe(0);
  });

  it("asApiError narrows or wraps unknown throwables", () => {
    const original = new ApiError({ code: "CONFLICT", message: "dup", details: null, status: 409 });
    expect(asApiError(original)).toBe(original);
    expect(asApiError(new Error("boom")).code).toBe("UNKNOWN");
    expect(asApiError("weird").code).toBe("UNKNOWN");
  });
});

describe("pagination — §6 shape", () => {
  it("builds page query with defaults", () => {
    expect(pageQuery()).toBe(`page=1&pageSize=${DEFAULT_PAGE_SIZE}`);
    expect(pageQuery({ page: 3, pageSize: 50 })).toBe("page=3&pageSize=50");
  });

  it("computes page count", () => {
    expect(pageCount({ total: 100, pageSize: 25 })).toBe(4);
    expect(pageCount({ total: 101, pageSize: 25 })).toBe(5);
    expect(pageCount({ total: 0, pageSize: 25 })).toBe(0);
  });
});
