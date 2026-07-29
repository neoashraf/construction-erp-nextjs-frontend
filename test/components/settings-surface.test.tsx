import { render, screen } from "@testing-library/react";
import SettingsPage from "@/app/(app)/settings/page";

const SETTINGS_RESOURCES = [
  "master_data.company_settings",
  "master_data.financial_years",
  "numbering",
] as const;

describe("Settings surface", () => {
  it("lists the three configuration screens at their existing routes", async () => {
    render(await SettingsPage());
    expect(screen.getByRole("link", { name: "Company settings" }))
      .toHaveAttribute("href", "/master-data/company-settings");
    expect(screen.getByRole("link", { name: "Financial years" }))
      .toHaveAttribute("href", "/master-data/financial-years");
    expect(screen.getByRole("link", { name: "Numbering" }))
      .toHaveAttribute("href", "/numbering");
  });

  it("names exactly the three settings resources", () => {
    expect(SETTINGS_RESOURCES).toHaveLength(3);
  });
});
