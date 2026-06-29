import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

/**
 * MSW server for component/integration tests that prefer to mock at the NETWORK
 * boundary rather than the module boundary (skill §10). The scaffold's own tests
 * mock fetch/the api module directly; this harness is the documented option that
 * per-screen feature tests use to mock the BFF endpoints they call.
 *
 * Usage in a test file:
 *   import { server } from "../msw/server";
 *   beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 */
export const handlers = [
  // Example: a stubbed BFF session read. Per-screen tests add/override handlers.
  http.get("/api/auth/me", () =>
    HttpResponse.json({
      user: {
        id: "u1",
        email: "admin@ze.test",
        name: "Admin",
        role: "ADMIN",
        companyId: "c1",
        financialYearId: "fy1",
        isActive: true,
      },
    }),
  ),
];

export const server = setupServer(...handlers);
