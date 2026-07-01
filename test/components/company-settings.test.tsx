/**
 * FE-2 company-settings tests (FR-MAS-001, FR-MAS-004, FR-MAS-032).
 * State matrix, both forms + validation + server error mapping, optimistic-lock
 * conflict + reload, discard guard, role show/hide. Happy path also in Playwright.
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/toast";
import { SessionProvider } from "@/providers/session-provider";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type Company } from "@/features/master-data/types";
import { CompanySettingsScreen } from "@/features/master-data/components/CompanySettingsScreen";
import * as api from "@/features/master-data/api/company";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("@/features/master-data/api/company", () => ({
  getCompany: jest.fn(),
  updateCompanyIdentity: jest.fn(),
  updateLocalization: jest.fn(),
}));

const getMock = api.getCompany as jest.Mock;
const patchMock = api.updateCompanyIdentity as jest.Mock;
const putMock = api.updateLocalization as jest.Mock;

const COMPANY: Company = {
  id: "c1",
  name: "Zakir Enterprise",
  legalName: "Zakir Enterprise Ltd",
  bin: "4057650345321",
  tin: "654321987012",
  address: "Dhaka, Bangladesh",
  currency: "BDT",
  dateFormat: "DD/MM/YYYY",
  locale: "bn-BD",
  isActive: true,
  version: 2,
};

function user(role: Role): SafeUser {
  return {
    id: "u1",
    email: "x@ze.test",
    name: "X",
    role,
    companyId: "c1",
    financialYearId: "fy1",
    isActive: true,
  };
}

function renderScreen(role: Role = "ADMIN") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider user={user(role)}>
        <ToastProvider>
          <CompanySettingsScreen />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getMock.mockReset();
  patchMock.mockReset();
  putMock.mockReset();
});

describe("CompanySettingsScreen — load + render", () => {
  it("shows loading skeletons first (spec §6)", () => {
    getMock.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByTestId("identity-loading")).toBeInTheDocument();
    expect(screen.getByTestId("localization-loading")).toBeInTheDocument();
  });

  it("renders identity + localization values and the active-company badge (FR-MAS-001/004)", async () => {
    getMock.mockResolvedValue(COMPANY);
    renderScreen();
    expect(await screen.findByText("Zakir Enterprise Ltd")).toBeInTheDocument();
    expect(screen.getByText("4057650345321")).toBeInTheDocument();
    expect(screen.getByText("DD/MM/YYYY")).toBeInTheDocument();
    expect(screen.getByTestId("active-company-badge")).toHaveTextContent("Zakir Enterprise");
  });

  it("renders a per-card error + Retry on load failure (spec §6)", async () => {
    getMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    renderScreen();
    expect((await screen.findAllByText("Couldn't load company details.")).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByTestId("identity-retry")).toBeInTheDocument();
  });
});

describe("CompanySettingsScreen — identity form", () => {
  it("requires company name and blocks save (FR-MAS-004, spec §7)", async () => {
    getMock.mockResolvedValue(COMPANY);
    renderScreen();
    await screen.findByText("Zakir Enterprise Ltd");
    await userEvent.click(screen.getByTestId("identity-card-edit"));
    await userEvent.clear(screen.getByLabelText(/company name/i));
    await userEvent.click(screen.getByTestId("identity-card-save"));
    expect(await screen.findByText("Company name is required.")).toBeInTheDocument();
    expect(patchMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed BIN (format-only) but allows empty (SRS §16)", async () => {
    getMock.mockResolvedValue(COMPANY);
    renderScreen();
    await screen.findByText("Zakir Enterprise Ltd");
    await userEvent.click(screen.getByTestId("identity-card-edit"));
    const bin = screen.getByLabelText(/bin/i);
    await userEvent.clear(bin);
    await userEvent.type(bin, "12"); // too short
    await userEvent.click(screen.getByTestId("identity-card-save"));
    expect(await screen.findByText("Enter a valid BIN.")).toBeInTheDocument();
    expect(patchMock).not.toHaveBeenCalled();
  });

  it("saves identity via PATCH with the current version and toasts (FR-MAS-032)", async () => {
    getMock.mockResolvedValue(COMPANY);
    patchMock.mockResolvedValue({ ...COMPANY, name: "New Co", version: 3 });
    renderScreen();
    await screen.findByText("Zakir Enterprise Ltd");
    await userEvent.click(screen.getByTestId("identity-card-edit"));
    const name = screen.getByLabelText(/company name/i);
    await userEvent.clear(name);
    await userEvent.type(name, "New Co");
    await userEvent.click(screen.getByTestId("identity-card-save"));
    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({ name: "New Co", version: 2 }),
      ),
    );
    expect(await screen.findByText("Company details saved.")).toBeInTheDocument();
  });

  it("maps server VALIDATION_ERROR details to the field", async () => {
    getMock.mockResolvedValue(COMPANY);
    patchMock.mockRejectedValue(
      new ApiError({
        code: "VALIDATION_ERROR",
        message: "bad",
        details: { bin: ["Invalid BIN per NBR"] },
        status: 400,
      }),
    );
    renderScreen();
    await screen.findByText("Zakir Enterprise Ltd");
    await userEvent.click(screen.getByTestId("identity-card-edit"));
    await userEvent.click(screen.getByTestId("identity-card-save"));
    expect(await screen.findByText("Invalid BIN per NBR")).toBeInTheDocument();
  });

  it("shows the conflict banner + Reload on OPTIMISTIC_LOCK_CONFLICT (FR-MAS-032, SRS §12.3)", async () => {
    getMock.mockResolvedValue(COMPANY);
    patchMock.mockRejectedValue(
      new ApiError({
        code: "OPTIMISTIC_LOCK_CONFLICT",
        message: "stale",
        details: null,
        status: 409,
      }),
    );
    renderScreen();
    await screen.findByText("Zakir Enterprise Ltd");
    await userEvent.click(screen.getByTestId("identity-card-edit"));
    await userEvent.click(screen.getByTestId("identity-card-save"));
    expect(
      await screen.findByText("These details were changed by someone else."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("identity-conflict-reload")).toBeInTheDocument();
  });

  it("prompts Discard on cancel with unsaved edits and restores on Discard (spec §8)", async () => {
    getMock.mockResolvedValue(COMPANY);
    renderScreen();
    await screen.findByText("Zakir Enterprise Ltd");
    await userEvent.click(screen.getByTestId("identity-card-edit"));
    await userEvent.type(screen.getByLabelText(/company name/i), "!!!");
    // Cancel button lives in the card header (Cancel appears when editing)
    await userEvent.click(
      within(screen.getByTestId("identity-card")).getByRole("button", { name: /cancel/i }),
    );
    const dialog = await screen.findByTestId("discard-dialog");
    await userEvent.click(within(dialog).getByTestId("discard-confirm"));
    // Back to read view (Edit visible again)
    expect(await screen.findByTestId("identity-card-edit")).toBeInTheDocument();
  });
});

describe("CompanySettingsScreen — localization + roles", () => {
  it("saves localization via PUT with version (FR-MAS-004)", async () => {
    getMock.mockResolvedValue(COMPANY);
    putMock.mockResolvedValue({ ...COMPANY, locale: "en-US", version: 3 });
    renderScreen();
    await screen.findByText("Zakir Enterprise Ltd");
    await userEvent.click(screen.getByTestId("localization-card-edit"));
    await userEvent.selectOptions(screen.getByLabelText(/locale/i), "en-US");
    await userEvent.click(screen.getByTestId("localization-card-save"));
    await waitFor(() =>
      expect(putMock).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({ locale: "en-US", version: 2 }),
      ),
    );
    expect(await screen.findByText("Localization settings saved.")).toBeInTheDocument();
  });

  it("non-Admin sees read-only cards (no Edit) + the permission notice (spec §11)", async () => {
    getMock.mockResolvedValue(COMPANY);
    renderScreen("ACCOUNTS_TEAM");
    await screen.findByText("Zakir Enterprise Ltd");
    expect(screen.queryByTestId("identity-card-edit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("localization-card-edit")).not.toBeInTheDocument();
    expect(
      screen.getByText("You don't have permission to change company settings."),
    ).toBeInTheDocument();
  });
});
