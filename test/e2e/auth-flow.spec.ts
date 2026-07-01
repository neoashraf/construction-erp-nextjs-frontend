import { test, expect } from "@playwright/test";

/**
 * Auth-flow e2e through the BFF (acceptance: "Auth cookie bridge works",
 * "Refresh-on-401 + rotation", "Logout clears cookies", "Route guards"). Runs
 * against the production build with the in-process mock NestJS (USE_MOCK_NESTJS).
 */

const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };
const PM = { email: "pm@ze.test", password: "Passw0rd!" };

const AUTH_COOKIES = ["ze_access", "ze_refresh", "ze_session"];

async function login(page: import("@playwright/test").Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  // Exact labels: the password show/hide button carries aria-label "Show password",
  // which a loose /password/i would also match (strict-mode collision).
  await page.getByLabel("Email", { exact: true }).fill(creds.email);
  await page.getByLabel("Password", { exact: true }).fill(creds.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("unauthenticated visitor to a guarded route is redirected to login", async ({ page }) => {
  await page.goto("/ledger");
  await page.waitForURL("**/login");
  await expect(page.getByTestId("login-form")).toBeVisible();
});

test("login sets httpOnly auth cookies and never exposes tokens to JS/localStorage", async ({ page, context }) => {
  await login(page, ADMIN);
  await expect(page.getByTestId("app-content")).toBeVisible();

  const cookies = await context.cookies();
  for (const name of AUTH_COOKIES) {
    const c = cookies.find((x) => x.name === name);
    expect(c, `${name} cookie set`).toBeTruthy();
    expect(c!.httpOnly, `${name} is httpOnly`).toBe(true);
  }
  // The CSRF cookie is intentionally readable (double-submit), but NOT httpOnly.
  const csrf = cookies.find((x) => x.name === "ze_csrf");
  expect(csrf).toBeTruthy();
  expect(csrf!.httpOnly).toBe(false);

  // No token is readable from client JS nor present in localStorage/sessionStorage.
  const storage = await page.evaluate(() => ({
    cookieReadable: document.cookie,
    local: JSON.stringify(window.localStorage),
    session: JSON.stringify(window.sessionStorage),
  }));
  expect(storage.cookieReadable).not.toContain("ze_access");
  expect(storage.cookieReadable).not.toContain("ze_refresh");
  expect(storage.local).not.toContain("access");
  expect(storage.local).not.toContain("token");
  expect(storage.session).not.toContain("token");
});

test("a proxied request transparently refreshes on a TOKEN_EXPIRED 401 and rotates cookies", async ({
  page,
  context,
}) => {
  // Log in with the special marker password so the mock issues an ALREADY-EXPIRED
  // access token — the first proxied call gets TOKEN_EXPIRED, the proxy refreshes,
  // rotates cookies, and retries once.
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(`${ADMIN.password}#expired`);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");

  const before = (await context.cookies()).find((c) => c.name === "ze_access")?.value;

  // Hit a proxied protected resource through the CATCH-ALL BFF proxy (not the
  // dedicated auth/me handler). The access token is expired, so the mock returns
  // TOKEN_EXPIRED → the proxy refreshes, rotates cookies, and retries once →
  // expect a 200 after refresh.
  const status = await page.evaluate(async () => {
    const res = await fetch("/api/ledger/ping", { credentials: "include" });
    return res.status;
  });
  expect(status).toBe(200);

  const after = (await context.cookies()).find((c) => c.name === "ze_access")?.value;
  expect(after).toBeTruthy();
  expect(after).not.toBe(before); // cookie was rotated
});

test("logout clears cookies; a subsequent guarded request redirects to login", async ({ page, context }) => {
  await login(page, ADMIN);
  await page.getByTestId("logout-button").click();
  await page.waitForURL("**/login");

  const cookies = await context.cookies();
  for (const name of AUTH_COOKIES) {
    expect(cookies.find((c) => c.name === name)?.value || "").toBe("");
  }
  await page.goto("/ledger");
  await page.waitForURL("**/login");
});

test("route guard: a role lacking a module is 403'd from that segment", async ({ page }) => {
  // PM may reach ledger but NOT audit (capability map).
  await login(page, PM);
  await page.goto("/audit");
  await expect(page.getByTestId("forbidden")).toBeVisible();

  await page.goto("/ledger");
  await expect(page.getByTestId("module-ledger")).toBeVisible();
  // The PM's sidebar shows ledger but not audit.
  await expect(page.getByTestId("nav-ledger")).toBeVisible();
  await expect(page.getByTestId("nav-audit")).toHaveCount(0);
});
