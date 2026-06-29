import { apiClient, BFF_BASE_PATH, CSRF_HEADER } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

/**
 * Unit-tests the configured apiClient: it targets the BFF base, includes
 * credentials, maps the §6 error envelope → ApiError, and returns the typed
 * pagination shape. fetch is mocked at the global boundary.
 */
describe("apiClient", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  // A minimal stand-in for the parts of Response that client.ts reads (status,
  // statusText, ok, text()). jsdom doesn't provide a global Response.
  function jsonResponse(body: unknown, status = 200) {
    return Promise.resolve({
      status,
      statusText: status >= 400 ? "Error" : "OK",
      ok: status >= 200 && status < 300,
      text: async () => (body === null ? "" : JSON.stringify(body)),
    } as Response);
  }

  it("targets the BFF base and includes credentials", async () => {
    fetchMock.mockReturnValue(jsonResponse({ ok: true }));
    await apiClient.get("/ledger/journal-entries");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(`${BFF_BASE_PATH}/ledger/journal-entries`);
    expect(init.credentials).toBe("include");
    expect(init.method).toBe("GET");
  });

  it("attaches the CSRF header on a state-changing request", async () => {
    fetchMock.mockReturnValue(jsonResponse({ ok: true }));
    await apiClient.post("/auth/logout", undefined, { csrfToken: "tok123" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.get(CSRF_HEADER)).toBe("tok123");
  });

  it("returns the typed { data, page, pageSize, total } pagination shape", async () => {
    fetchMock.mockReturnValue(
      jsonResponse({ data: [{ id: "1" }], page: 1, pageSize: 25, total: 1 }),
    );
    const result = await apiClient.getPage<{ id: string }>("/users?page=1&pageSize=25");
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.pageSize).toBe(25);
  });

  it("maps a non-2xx envelope to a thrown ApiError", async () => {
    fetchMock.mockReturnValue(
      jsonResponse({ error: { code: "FORBIDDEN", message: "nope", details: null } }, 403),
    );
    await expect(apiClient.get("/audit-logs")).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    await expect(apiClient.get("/audit-logs")).rejects.toBeInstanceOf(ApiError);
  });

  it("resolves 204 to undefined", async () => {
    fetchMock.mockReturnValue(jsonResponse(null, 204));
    await expect(apiClient.post("/auth/logout")).resolves.toBeUndefined();
  });

  it("throws a NETWORK_ERROR when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiClient.get("/ledger")).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });
});
