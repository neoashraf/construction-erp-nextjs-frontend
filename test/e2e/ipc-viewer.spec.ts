import { test, expect, type Page } from "@playwright/test";

/**
 * FE-34 IPC viewer + Mushak print happy path (FR-SAL-010/-012/-024): open a seeded POSTED
 * IPC → see the header + balanced ledger lines → open the Mushak print preview in a new
 * tab. Runs against the production build with the in-process mock NestJS (Admin — full
 * SAL access), driving `ipc-7` (seeded POSTED with journalEntryId `je-ipc-7`).
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("IPC viewer — open posted IPC, see balanced ledger lines, open Mushak print", async ({ page, context }) => {
  await login(page);
  await page.goto("/sales/ipcs/ipc-7/view");

  await expect(page.getByTestId("ipc-viewer-title")).toContainText("IPC/2526/0007");
  await expect(page.getByTestId("ipc-status-POSTED")).toBeVisible();
  await expect(page.getByTestId("ipc-immutability-note")).toContainText(/Posted IPCs can.t be edited/);
  await expect(page.getByTestId("ipc-key-figures")).toBeVisible();

  // Balanced ledger lines panel — server-written figures, viewer never re-derives.
  await expect(page.getByTestId("ipc-ledger-lines")).toBeVisible();
  await expect(page.getByTestId("ipc-lines-totals").first()).toContainText(/balanced/i);

  // View-in-ledger routes via journalEntryId (never re-derived here).
  const viewInLedger = page.getByTestId("ipc-viewer-view-in-ledger");
  await expect(viewInLedger).toHaveAttribute("href", "/ledger/entry-viewer?id=je-ipc-7");

  // Print opens the Mushak preview in a new tab (Button asChild composes onto the <a>).
  const printLink = page.getByTestId("ipc-viewer-print");
  await expect(printLink).toHaveAttribute("target", "_blank");
  const [printPage] = await Promise.all([
    context.waitForEvent("page"),
    printLink.click(),
  ]);
  await printPage.waitForLoadState("domcontentloaded");
  await expect(printPage.getByTestId("mushak-legal-no")).toContainText("IPC/2526/0007");
  await expect(printPage.getByTestId("mushak-company-bin")).toContainText("004123456-0203");
  await expect(printPage.getByTestId("mushak-currently-due")).toBeVisible();
});
