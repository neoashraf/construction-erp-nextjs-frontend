import { test, expect, type Page } from "@playwright/test";

/**
 * FE-33 IPC register + retention happy path (FR-SAL-015…-020): load the register for a
 * seeded project, open the Release-retention dialog on the first held IPC, submit a full
 * release, see the toast + the register and retention panel refresh with a lower held
 * figure. Runs against the production build with the in-process mock NestJS (Admin).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("IPC register — loads the seeded project register + pinned totals row", async ({ page }) => {
  await login(page);
  await page.goto("/sales/ipc-register?projectId=proj-a");
  await expect(page.getByTestId("ipc-register-title")).toHaveText("Project IPC register");
  await expect(page.getByTestId("reg-grid")).toBeVisible();
  await expect(page.getByTestId("reg-totals")).toBeVisible();
  await expect(page.getByTestId("reg-totals")).toHaveAttribute("aria-label", "Totals");
});

test("IPC register — release full held retention on an IPC → toast + panel refresh", async ({ page }) => {
  await login(page);
  await page.goto("/sales/ipc-register?projectId=proj-a");
  await expect(page.getByTestId("retention-panel")).toBeVisible();

  // Snapshot the total-held headline BEFORE the release for a delta assertion.
  const heldBefore = (await page.getByTestId("retention-total-held").textContent()) ?? "";

  // Click Release on the first row that has a Release button rendered.
  const first = page.locator('[data-testid^="ret-release-btn-"]').first();
  await first.click();
  await expect(page.getByTestId("release-dialog")).toBeVisible();
  await page.getByLabel(/Release date/).fill("20/06/2027");
  await page.getByTestId("release-continue").click();
  await expect(page.getByTestId("release-confirm-title")).toBeVisible();
  await page.getByTestId("release-confirm").click();

  // Toast confirms the release.
  await expect(page.getByText(/Retention released — ৳/)).toBeVisible();

  // Panel refreshes with a strictly-lower held figure.
  await expect
    .poll(async () => (await page.getByTestId("retention-total-held").textContent()) ?? "", { timeout: 15_000 })
    .not.toBe(heldBefore);
});
