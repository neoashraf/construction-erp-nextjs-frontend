import { test, expect, type Page } from "@playwright/test";

/**
 * FE-52 fe-account-profile — happy path (FR-AUD-029/-032/-038). Login → open
 * My Profile from the sidebar user popover → edit the display name → Save →
 * "Profile updated." toast → upload a PNG avatar → the initials placeholder
 * flips to the served image.
 */
const ADMIN = { email: "admin@ze.test", password: "Passw0rd!" };

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard");
}

test("My Profile — edit name + upload avatar happy path", async ({ page }) => {
  await login(page);
  await page.goto("/profile");

  await expect(page.getByTestId("profile-title")).toContainText("My profile");
  await expect(page.getByTestId("profile-identity-name")).toBeVisible();

  // The default admin has an existing phone; edit only the name so the guard
  // stays honest (Save should enable on this single dirty field).
  const nameInput = page.getByTestId("profile-name-input");
  await nameInput.fill("Ashraf Uddin");
  await expect(page.getByTestId("profile-save")).toBeEnabled();
  await page.getByTestId("profile-save").click();
  await expect(page.getByText(/Profile updated\./i)).toBeVisible();

  // Upload a PNG — a tiny 1x1 buffer is enough to satisfy the mock endpoint.
  const fileInput = page.getByTestId("profile-avatar-file-input");
  const pngBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAABlBMVEUAAAD///+l2Z/dAAAACklEQVR4nGNiAAAABgADNjd8qAAAAABJRU5ErkJggg==",
    "base64",
  );
  await fileInput.setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: pngBytes });
  await expect(page.getByText(/Photo updated\./i)).toBeVisible();
  await expect(page.getByTestId("profile-avatar-image")).toBeVisible();
});
