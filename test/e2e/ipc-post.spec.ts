import { test, expect, type Page } from "@playwright/test";

/**
 * FE-32 IPC post happy path (FR-SAL-001/-009…-012): create a DRAFT → capture the certificate
 * figures → Post behind the confirm dialog → the IPC flips read-only and shows the allocated
 * gapless Mushak number. Runs against the production build with the in-process mock NestJS
 * (logged in as Admin — full SAL access). A timestamp-based sequence number keeps reruns unique.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };
const SEQ = String((Date.now() % 90000) + 1000);

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("IPC — list loads with seeded rows", async ({ page }) => {
  await login(page);
  await page.goto("/sales/ipcs");
  await expect(page.getByTestId("ipc-list-title")).toHaveText("IPC list");
  await expect(page.getByTestId("ipc-list")).toBeVisible();
  await expect(page.getByTestId("ipc-status-POSTED").first()).toBeVisible();
});

test("IPC — create draft, capture figures, post, see allocated number", async ({ page }) => {
  await login(page);
  await page.goto("/sales/ipcs/new");
  await expect(page.getByTestId("ipc-editor-title")).toHaveText("New IPC");

  await page.getByTestId("ipc-project").selectOption("proj-a");
  await page.getByTestId("ipc-seq").fill(SEQ);
  await page.getByLabel(/^IPC date/).fill("12/07/2026");
  await page.getByLabel(/^Bill date/).fill("12/07/2026");
  await page.getByLabel(/^Due date/).fill("11/08/2026");
  await page.getByTestId("ipc-work").fill("45");
  await page.getByTestId("ipc-certified").fill("1000000");
  await page.getByTestId("ipc-cc").selectOption("cc-mat");
  await expect(page.getByTestId("ipc-purpose")).toBeEnabled();
  await page.getByTestId("ipc-purpose").selectOption("pp-1");

  // Currently due = 1,000,000 + 75,000 − 100,000 − 150,000 − 0 = 825,000.
  await expect(page.getByTestId("ipc-currently-due")).toContainText("825,000.0000");
  // Ledger effect preview must balance (the editor never asserts this — LED does).
  await expect(page.getByTestId("ipc-ledger-balance")).toContainText("balanced");

  // Post behind the mandatory confirm dialog.
  await page.getByTestId("ipc-post").click();
  await expect(page.getByTestId("ipc-post-dialog")).toBeVisible();
  await page.getByTestId("ipc-post-confirm").click();

  // The IPC flips POSTED and shows the allocated gapless number.
  await page.waitForURL(/\/sales\/ipcs\/ipc-\d+/);
  await expect(page.getByTestId("ipc-status-POSTED")).toBeVisible();
  await expect(page.getByTestId("ipc-entry-no")).toBeVisible();
  await expect(page.getByTestId("ipc-entry-no")).toContainText("IPC/2526/");
});
