import { test, expect, type Page } from "@playwright/test";

/**
 * FE-35 Employee-master happy path (FR-HR-001, -002, -003): create an office-staff employee
 * from the slide-over drawer, land on the detail page, reassign to another project (append to
 * the history), then deactivate. Runs against the production build with the in-process mock
 * NestJS (logged in as Admin — HR write scope). A timestamp-based code keeps reruns unique.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };
const CODE = `EMP-E2E-${(Date.now() % 90000) + 1000}`;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("Employee — create → reassign → deactivate", async ({ page }) => {
  await login(page);
  await page.goto("/hr/employees");
  await expect(page.getByTestId("employee-list-title")).toHaveText("Employees");

  // Open the create drawer.
  await page.getByTestId("employee-new").click();
  await expect(page.getByTestId("employee-create-drawer")).toBeVisible();

  await page.getByTestId("emp-code").fill(CODE);
  await page.getByTestId("emp-name").fill("E2E Employee");
  await page.getByTestId("emp-workbase").selectOption("HEAD_OFFICE");
  await page.getByTestId("emp-wagetype").selectOption("MONTHLY");
  await page.getByTestId("emp-wageamount").fill("48000");
  await page.getByTestId("emp-joining").fill("01/03/2024");
  await page.getByTestId("employee-save").click();

  // Detail page landed.
  await expect(page.getByTestId("employee-detail")).toBeVisible();
  await expect(page.getByTestId("employee-name")).toHaveText("E2E Employee");

  // Reassign to a project.
  await page.getByTestId("employee-reassign").click();
  const reassign = page.getByTestId("reassign-dialog");
  await expect(reassign).toBeVisible();
  await reassign.getByTestId("reassign-project").selectOption({ index: 1 });
  await reassign.getByTestId("reassign-date").fill("01/06/2024");
  await reassign.getByTestId("reassign-confirm").click();
  await expect(reassign).not.toBeVisible();

  // Deactivate → status flips.
  await page.getByTestId("employee-deactivate").click();
  const deactivate = page.getByTestId("deactivate-dialog");
  await deactivate.getByTestId("deactivate-confirm").click();
  await expect(page.getByTestId("employee-status-INACTIVE")).toBeVisible();
});
