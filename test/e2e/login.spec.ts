import { test, expect, devices } from "@playwright/test";

/**
 * FE-1 login SCREEN e2e (FR-AUD-001..004, 008, 009). Complements auth-flow.spec.ts
 * (the BFF cookie bridge) with the designed-screen behaviours: httpOnly cookies +
 * no token in JS, the generic-error rule, client validation, the session-expired
 * banner, and mobile (360) sign-in. Runs against the in-process mock NestJS.
 */

const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };
const AUTH_COOKIES = ["ze_access", "ze_refresh", "ze_session"];

const email = (p: import("@playwright/test").Page) => p.getByLabel("Email", { exact: true });
const password = (p: import("@playwright/test").Page) => p.getByLabel("Password", { exact: true });
const signIn = (p: import("@playwright/test").Page) =>
  p.getByRole("button", { name: /^sign in$/i });

test("happy path: login sets httpOnly cookies and leaks no token to JS (FR-AUD-002/003)", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await email(page).fill(ADMIN.email);
  await password(page).fill(ADMIN.password);
  await signIn(page).click();
  await page.waitForURL("**/dashboard");

  const cookies = await context.cookies();
  for (const name of AUTH_COOKIES) {
    const c = cookies.find((x) => x.name === name);
    expect(c, `${name} cookie set`).toBeTruthy();
    expect(c!.httpOnly, `${name} is httpOnly`).toBe(true);
  }

  // No token readable from client JS, localStorage, or sessionStorage.
  const storage = await page.evaluate(() => ({
    cookieReadable: document.cookie,
    local: JSON.stringify(window.localStorage),
    session: JSON.stringify(window.sessionStorage),
  }));
  expect(storage.cookieReadable).not.toContain("ze_access");
  expect(storage.cookieReadable).not.toContain("ze_refresh");
  expect(storage.local).not.toContain("token");
  expect(storage.session).not.toContain("token");
});

test("wrong credentials show the generic banner — no enumeration (FR-AUD-001/009)", async ({
  page,
}) => {
  await page.goto("/login");
  await email(page).fill(ADMIN.email);
  await password(page).fill("definitely-wrong");
  await signIn(page).click();

  // Target the banner by testid — Next injects its own role="alert" route announcer.
  const banner = page.getByTestId("auth-error-banner");
  await expect(banner).toHaveText("Incorrect email or password.");
  await expect(banner).toHaveAttribute("role", "alert");
  // Still on the login screen; no redirect.
  await expect(page).toHaveURL(/\/login$/);
});

test("client validation blocks submit with inline messages (spec §7)", async ({ page }) => {
  await page.goto("/login");
  await signIn(page).click();
  await expect(page.getByText("Enter your email.")).toBeVisible();
  await expect(page.getByText("Enter your password.")).toBeVisible();
  // No redirect occurred.
  await expect(page).toHaveURL(/\/login$/);
});

test("show/hide toggle reveals and re-masks the password (spec §10)", async ({ page }) => {
  await page.goto("/login");
  await password(page).fill("secret123");
  await expect(password(page)).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: /show password/i }).click();
  await expect(password(page)).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: /hide password/i }).click();
  await expect(password(page)).toHaveAttribute("type", "password");
});

test("session-expired re-entry shows the expired banner (FR-AUD-004)", async ({ page }) => {
  await page.goto("/login?expired=1");
  await expect(page.getByTestId("auth-error-banner")).toHaveText(
    "Your session has expired. Please sign in again.",
  );
});

test.describe("mobile 360 — site staff sign in from phones (spec §4)", () => {
  test.use({ viewport: { ...devices["Pixel 5"].viewport, width: 360, height: 740 } });

  test("card renders and submits at 360px width", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-form")).toBeVisible();
    await email(page).fill(ADMIN.email);
    await password(page).fill(ADMIN.password);
    await signIn(page).click();
    await page.waitForURL("**/dashboard");
  });
});
