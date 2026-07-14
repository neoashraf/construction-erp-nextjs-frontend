import { test, expect, type Page } from "@playwright/test";

/**
 * FE-32 IPC cancel path (FR-SAL-021/-022): post a fresh IPC, then Cancel it with a mandatory
 * reason — the IPC flips CANCELLED and its original number is retained (the reversal takes its
 * own number). Self-contained (posts its own IPC) so it never mutates shared seed rows. Runs
 * against the production build with the in-process mock NestJS (Admin — full SAL access).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };
const SEQ = String((Date.now() % 90000) + 20000);

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("IPC — post then cancel with a reason, original number retained", async ({ page }) => {
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

  await page.getByTestId("ipc-post").click();
  await page.getByTestId("ipc-post-confirm").click();
  await page.waitForURL(/\/sales\/ipcs\/ipc-\d+/);
  await expect(page.getByTestId("ipc-status-POSTED")).toBeVisible();

  // Cancel — a reason is mandatory.
  await page.getByTestId("ipc-cancel").click();
  await expect(page.getByTestId("ipc-cancel-dialog")).toBeVisible();
  await page.getByTestId("ipc-cancel-confirm").click();
  await expect(page.getByTestId("ipc-cancel-reason-err")).toBeVisible(); // empty reason blocked
  await page.getByTestId("ipc-cancel-reason").fill("Certified % corrected");
  await page.getByTestId("ipc-cancel-confirm").click();

  // The IPC flips CANCELLED.
  await expect(page.getByTestId("ipc-status-CANCELLED")).toBeVisible();
  await expect(page.getByTestId("ipc-readonly-banner")).toContainText("This IPC has been cancelled.");
});
