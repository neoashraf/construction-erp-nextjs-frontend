/**
 * Response-envelope shape tests for the `/ledger/entries/{id}` reads used by the
 * voucher viewers (payments FE-47, receipts, LED entry-viewer).
 *
 * The NestJS `ResponseEnvelopeInterceptor` is global and wraps EVERY non-streaming
 * response as `{ data, meta }` — `/ledger/entries/:id` has no `@NoEnvelope`. A fetch
 * that forgets to unwrap `.data` therefore hands the viewer the envelope itself, whose
 * `.lines` is undefined — `entry.lines.map(...)` then throws mid-render and takes the
 * whole route down. These tests pin the unwrapping at the api layer, where the
 * component tests (which mock the api module wholesale) cannot see it.
 */
import { getPaymentJournalEntry } from "@/features/payments/api/payment";
import { getReceiptJournalEntry } from "@/features/receipts/api/receipt";
import { getJournalEntry } from "@/features/ledger/api/entries";
import { apiClient } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const apiGet = apiClient.get as jest.Mock;

/** Exactly what the backend returns for GET /ledger/entries/{id}. */
const ENTRY = {
  id: "je-1",
  entryNo: "JE/2526/0104",
  voucherType: "PAYMENT",
  voucherDate: "2026-06-05",
  postedAt: "2026-06-05T10:15:00.000Z",
  totalDebit: "4258.0645",
  totalCredit: "4258.0645",
  lines: [
    {
      id: "jl-1",
      lineNo: 1,
      accountId: "acc-ap",
      projectId: null,
      costCentreId: null,
      purposeId: null,
      godownId: null,
      partyId: null,
      debit: "4258.0645",
      credit: "0.0000",
      narration: null,
    },
  ],
};

const ENVELOPE = { data: ENTRY, meta: { requestId: "e38b1516-e46e-409a-9c3a-41343781f927" } };

beforeEach(() => {
  jest.clearAllMocks();
  apiGet.mockResolvedValue(ENVELOPE);
});

describe("GET /ledger/entries/{id} — envelope unwrapping", () => {
  it("payments viewer unwraps `.data` and exposes the lines array", async () => {
    const entry = await getPaymentJournalEntry("je-1");
    expect(entry.lines).toHaveLength(1);
    expect(entry.totalDebit).toBe("4258.0645");
    // The envelope must never leak through — `.lines` would be undefined and the
    // viewer's `entry.lines.map(...)` would throw.
    expect((entry as unknown as { data?: unknown }).data).toBeUndefined();
  });

  it("receipts viewer unwraps `.data` and exposes the lines array", async () => {
    const entry = await getReceiptJournalEntry("je-1");
    expect(entry.lines).toHaveLength(1);
    expect((entry as unknown as { data?: unknown }).data).toBeUndefined();
  });

  it("ledger entry-viewer unwraps `.data` and exposes the lines array", async () => {
    const entry = await getJournalEntry("je-1");
    expect(entry.lines).toHaveLength(1);
    expect((entry as unknown as { data?: unknown }).data).toBeUndefined();
  });
});
