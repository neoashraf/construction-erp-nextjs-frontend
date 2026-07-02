import { listUsers } from "@/features/master-data/api/users";
import { apiClient } from "@/lib/api";

/**
 * Regression: listUsers powers the Projects screen's PM picker. A malformed/empty
 * `/users` response (or the endpoint being unavailable) previously handed a non-array
 * to the caller's `.map`, white-screening the whole Projects page with
 * "(…).map is not a function". listUsers must always resolve to an array so the
 * picker degrades to empty instead of crashing.
 */
jest.mock("@/lib/api", () => ({ apiClient: { get: jest.fn() } }));
const getMock = apiClient.get as jest.Mock;

describe("master-data listUsers — defensive shape", () => {
  beforeEach(() => getMock.mockReset());

  it("returns the array when the envelope is well-formed", async () => {
    getMock.mockResolvedValue({ data: [{ id: "u1", name: "Rahim", email: "r@ze.test", role: "PROJECT_MANAGER" }] });
    await expect(listUsers()).resolves.toEqual([
      { id: "u1", name: "Rahim", email: "r@ze.test", role: "PROJECT_MANAGER" },
    ]);
  });

  it("returns [] when data is missing", async () => {
    getMock.mockResolvedValue({});
    await expect(listUsers()).resolves.toEqual([]);
  });

  it("returns [] when data is not an array (malformed payload)", async () => {
    getMock.mockResolvedValue({ data: { unexpected: "object" } });
    await expect(listUsers()).resolves.toEqual([]);
  });

  it("returns [] when the body itself is null/empty (204-like)", async () => {
    getMock.mockResolvedValue(null);
    await expect(listUsers()).resolves.toEqual([]);
  });
});
