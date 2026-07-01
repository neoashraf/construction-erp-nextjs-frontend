/**
 * FE-20 audit-logs API binding unit tests (FR-AUD-020/021/026/027). The live
 * `GET /api/audit-logs` wraps its payload as `{ items, total }` (confirmed against
 * the merged backend controller/query-service) rather than the platform's usual
 * `{ data: T[], meta: {page,pageSize,total} }` — `listAuditLogs` must normalise
 * BOTH shapes into the standard `Paginated<T>` the rest of the app expects.
 */
import { listAuditLogs, getAuditLog } from "@/features/audit/api/audit-logs";

describe("listAuditLogs — response-shape normalisation", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  function jsonResponse(body: unknown, status = 200) {
    return Promise.resolve({
      status,
      statusText: status >= 400 ? "Error" : "OK",
      ok: status >= 200 && status < 300,
      text: async () => JSON.stringify(body),
    } as Response);
  }

  const ROW = {
    id: "a1",
    action: "UPDATE",
    entityType: "Project",
    entityId: "p1",
    userId: "u1",
    ipAddress: "10.0.0.1",
    createdAt: "2026-06-30T10:00:00Z",
  };

  it("normalises the LIVE `{ data: { items, total } }` shape into Paginated<T>", async () => {
    fetchMock.mockReturnValue(
      jsonResponse({ data: { items: [ROW], total: 1 }, meta: { requestId: "r1" } }),
    );
    const result = await listAuditLogs({ page: 1, pageSize: 25 });
    expect(result.data).toEqual([ROW]);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });

  it("also tolerates the documented `{ data: T[], meta: {page,pageSize,total} }` shape", async () => {
    fetchMock.mockReturnValue(
      jsonResponse({ data: [ROW], meta: { page: 2, pageSize: 25, total: 40 } }),
    );
    const result = await listAuditLogs({ page: 2, pageSize: 25 });
    expect(result.data).toEqual([ROW]);
    expect(result.total).toBe(40);
    expect(result.page).toBe(2);
  });

  it("builds the query string from the filter (entityType/entityId/userId/action/projectId/dateFrom/dateTo)", async () => {
    fetchMock.mockReturnValue(jsonResponse({ data: { items: [], total: 0 } }));
    await listAuditLogs({
      entityType: "Project",
      entityId: "p1",
      userId: "u1",
      action: "UPDATE",
      projectId: "proj-a",
      dateFrom: "2026-01-01",
      dateTo: "2026-06-30",
      page: 1,
      pageSize: 25,
    });
    const [url] = fetchMock.mock.calls[0];
    const qs = String(url);
    expect(qs).toContain("entityType=Project");
    expect(qs).toContain("entityId=p1");
    expect(qs).toContain("userId=u1");
    expect(qs).toContain("action=UPDATE");
    expect(qs).toContain("projectId=proj-a");
    expect(qs).toContain("dateFrom=2026-01-01");
    expect(qs).toContain("dateTo=2026-06-30");
    expect(qs).toContain("page=1");
    expect(qs).toContain("pageSize=25");
  });

  it("defaults page=1, pageSize=25 when omitted", async () => {
    fetchMock.mockReturnValue(jsonResponse({ data: { items: [], total: 0 } }));
    const result = await listAuditLogs({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });
});

describe("getAuditLog", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  function jsonResponse(body: unknown, status = 200) {
    return Promise.resolve({
      status,
      statusText: status >= 400 ? "Error" : "OK",
      ok: status >= 200 && status < 300,
      text: async () => JSON.stringify(body),
    } as Response);
  }

  it("unwraps the { data } envelope for a single entry", async () => {
    const detail = {
      id: "a1",
      action: "CREATE",
      entityType: "Project",
      entityId: "p1",
      userId: "u1",
      before: null,
      after: { name: "Bridge-04" },
      ipAddress: null,
      seal: "sha256:abc",
      createdAt: "2026-06-30T10:00:00Z",
    };
    fetchMock.mockReturnValue(jsonResponse({ data: detail, meta: { requestId: "r1" } }));
    const result = await getAuditLog("a1");
    expect(result).toEqual(detail);
  });
});
