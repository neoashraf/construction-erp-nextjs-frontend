/**
 * FE-65 Holidays tests (FR-HR-008d; input to FR-HR-013a). Covers the payroll-critical
 * behaviours the enhance brief adds to the shipped screen: the full-replace copy, the
 * remove/clear-all confirmations (PUT fires only on confirm), the persistent
 * zero-off-days alert, response-seeded weekly state, the Source column, the untruncated
 * Bangla second line, the Type-select removal, the overwrite notice (incl. the
 * import→manual one-way door), confirmed deletes with an informational 404, in-place
 * Edit, the "—" fallback on the approx card, the both-counts feed toast, mutually
 * disabled imports, and the read-only projection for a role without write access.
 */
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { HolidayManagementShell } from "@/features/hr/components/HolidayManagementShell";
import * as holidaysApi from "@/features/hr/api/holidays";
import type { GovernmentHoliday } from "@/features/hr/api/holidays";

jest.mock("@/features/hr/api/holidays");

const getWeeklyMock = holidaysApi.getWeeklyOffDays as jest.Mock;
const saveWeeklyMock = holidaysApi.saveWeeklyOffDays as jest.Mock;
const listHolidaysMock = holidaysApi.listGovernmentHolidays as jest.Mock;
const createHolidayMock = holidaysApi.createGovernmentHoliday as jest.Mock;
const deleteHolidayMock = holidaysApi.deleteGovernmentHoliday as jest.Mock;
const importFeedMock = holidaysApi.importGovernmentHolidays as jest.Mock;
const importRowsMock = holidaysApi.importHolidaysFromRows as jest.Mock;

const YEAR = new Date().getFullYear();

function holiday(over: Partial<GovernmentHoliday> = {}): GovernmentHoliday {
  return {
    id: "h-independence",
    date: `${YEAR}-03-26`,
    name: "Independence Day",
    localName: "স্বাধীনতা দিবস",
    source: "import",
    ...over,
  };
}

const SAMPLE: GovernmentHoliday[] = [
  holiday(),
  holiday({
    id: "h-office",
    date: `${YEAR}-05-02`,
    name: "Office Closure",
    localName: null,
    source: "manual",
  }),
];

function user(role: Role): SafeUser {
  return {
    id: "u1",
    email: "x@ze.test",
    name: "X",
    role,
    companyId: "c1",
    financialYearId: "fy-1",
    isActive: true,
  };
}

function renderShell(role: Role = "HR_MANAGER") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user(role)}>
          <HolidayManagementShell />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  getWeeklyMock.mockResolvedValue({ weekdays: [5, 6] });
  listHolidaysMock.mockResolvedValue(SAMPLE);
  saveWeeklyMock.mockImplementation((weekdays: number[]) =>
    Promise.resolve({ weekdays: [...weekdays].sort() }),
  );
  createHolidayMock.mockResolvedValue(holiday());
  deleteHolidayMock.mockResolvedValue(undefined);
  importFeedMock.mockResolvedValue(SAMPLE);
  importRowsMock.mockResolvedValue({ holidays: SAMPLE, importedCount: 2 });
});

async function loaded() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Friday" })).toBeInTheDocument());
}

describe("weekly off-days panel", () => {
  it("states the full-replace and year-scope rules as always-visible copy", async () => {
    renderShell();
    await loaded();
    expect(
      screen.getByText(/Saving replaces the whole list\. A weekday you unselect stops being a holiday everywhere/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Weekly off-days apply to every year — the year selector below only filters the dated calendar\./),
    ).toBeInTheDocument();
  });

  it("confirms before a save that removes a weekday, and PUTs only on confirm", async () => {
    renderShell();
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: "Friday" }));
    await userEvent.click(screen.getByRole("button", { name: "Save off-days" }));

    expect(await screen.findByText("Remove Friday as a weekly off-day?")).toBeInTheDocument();
    expect(saveWeeklyMock).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Friday will count as a working day from now on, in every month — including months already reported\./),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove off-day" }));
    await waitFor(() => expect(saveWeeklyMock).toHaveBeenCalledWith([6]));
  });

  it("cancelling the removal leaves the selection and the server untouched", async () => {
    renderShell();
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: "Saturday" }));
    await userEvent.click(screen.getByRole("button", { name: "Save off-days" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(saveWeeklyMock).not.toHaveBeenCalled();
    // The local selection is kept — Save stays enabled for another attempt.
    expect(screen.getByRole("button", { name: "Save off-days" })).toBeEnabled();
  });

  it("confirms clear-all with its own dialog before sending []", async () => {
    renderShell();
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: "Friday" }));
    await userEvent.click(screen.getByRole("button", { name: "Saturday" }));
    await userEvent.click(screen.getByRole("button", { name: "Save off-days" }));

    expect(await screen.findByText("Clear every weekly off-day?")).toBeInTheDocument();
    expect(saveWeeklyMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Clear all off-days" }));
    await waitFor(() => expect(saveWeeklyMock).toHaveBeenCalledWith([]));
  });

  it("renders the persistent zero-off-days alert when no weekdays are saved", async () => {
    getWeeklyMock.mockResolvedValue({ weekdays: [] });
    renderShell();
    await loaded();
    const alert = screen.getByTestId("zero-off-days-alert");
    expect(alert).toHaveAttribute("role", "alert");
    expect(
      within(alert).getByText(/No weekly off-days are set — every day of the week counts as a working day\./),
    ).toBeInTheDocument();
  });

  it("re-seeds the toggles from the server's normalised response, not the sent list", async () => {
    // The server drops Monday (junk from its point of view) — the toggle must not stay on.
    saveWeeklyMock.mockResolvedValue({ weekdays: [5, 6] });
    renderShell();
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: "Monday" }));
    await userEvent.click(screen.getByRole("button", { name: "Save off-days" }));

    await waitFor(() => expect(saveWeeklyMock).toHaveBeenCalledWith([5, 6, 1]));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Monday" })).toHaveAttribute("aria-pressed", "false"),
    );
    expect(screen.getByText("2 days per week")).toBeInTheDocument();
  });

  it("renders no toggles on a weekly load failure — only the alert and Retry", async () => {
    getWeeklyMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "boom", status: 500 }),
    );
    renderShell();
    await waitFor(() =>
      expect(screen.getByText("Couldn't load weekly off-days.")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: "Friday" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Retry" }).length).toBeGreaterThan(0);
  });
});

describe("holiday calendar panel", () => {
  it("shows Source as readable text — From feed / Entered by hand", async () => {
    renderShell();
    await loaded();
    expect(await screen.findAllByText("From feed")).not.toHaveLength(0);
    const manual = await screen.findAllByText("Entered by hand");
    expect(manual.length).toBeGreaterThan(0);
    expect(manual[0]).toHaveAttribute("title", "The year-end import leaves this row alone.");
  });

  it("renders the Bangla localName on its own line, untruncated", async () => {
    renderShell();
    await loaded();
    const bangla = await screen.findAllByText("স্বাধীনতা দিবস");
    expect(bangla.length).toBeGreaterThan(0);
    for (const el of bangla) {
      expect(el.className).not.toMatch(/truncate|line-clamp|text-ellipsis/);
    }
  });

  it("renders '—' on the approx working-days card while the weekly query is unresolved", async () => {
    let resolveWeekly: (v: { weekdays: number[] }) => void = () => undefined;
    getWeeklyMock.mockReturnValue(new Promise((res) => (resolveWeekly = res)));
    renderShell();
    await waitFor(() => expect(screen.getAllByText("Independence Day").length).toBeGreaterThan(0));

    const card = screen.getByRole("group", {
      name: /Working days \(approx\.\) — Estimate only — payroll uses the exact per-employee figure\./,
    });
    expect(within(card).getByText("—")).toBeInTheDocument();

    resolveWeekly({ weekdays: [5, 6] });
    await waitFor(() => expect(within(card).queryByText("—")).not.toBeInTheDocument());
  });

  it("reports both counts after a feed import — written and left unchanged", async () => {
    importFeedMock.mockResolvedValue([
      holiday({ id: "a", date: `${YEAR}-02-21`, source: "import" }),
      holiday({ id: "b", date: `${YEAR}-03-26`, source: "import" }),
      holiday({ id: "c", date: `${YEAR}-05-02`, source: "manual" }),
    ]);
    renderShell();
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: /Import from API/ }));
    expect(
      await screen.findByText("2 holidays imported · 1 hand-entered rows left unchanged."),
    ).toBeInTheDocument();
  });

  it("disables the other import while one is in flight", async () => {
    let resolveFeed: (v: GovernmentHoliday[]) => void = () => undefined;
    importFeedMock.mockReturnValue(new Promise((res) => (resolveFeed = res)));
    renderShell();
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: /Import from API/ }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Import Excel/ })).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: /Importing…/ })).toBeInTheDocument();
    resolveFeed(SAMPLE);
  });

  it("confirms a delete first, states its retroactive reach, and deletes only on confirm", async () => {
    renderShell();
    await loaded();
    await userEvent.click(screen.getAllByRole("button", { name: "Delete Independence Day" })[0]!);

    expect(await screen.findByText("Delete Independence Day?")).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`26/03/${YEAR} will count as a working day again`)),
    ).toBeInTheDocument();
    expect(deleteHolidayMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Delete holiday" }));
    await waitFor(() => expect(deleteHolidayMock).toHaveBeenCalledWith("h-independence"));
  });

  it("resolves a 404 delete informationally — the row still leaves the list", async () => {
    deleteHolidayMock.mockRejectedValue(
      new ApiError({ code: "NOT_FOUND", message: "Holiday not found", status: 404 }),
    );
    renderShell();
    await loaded();
    await userEvent.click(screen.getAllByRole("button", { name: "Delete Independence Day" })[0]!);
    // The other admin's delete is real server-side: the refetch after cache invalidation
    // must not resurrect the row.
    listHolidaysMock.mockResolvedValue([SAMPLE[1]!]);
    await userEvent.click(await screen.findByRole("button", { name: "Delete holiday" }));

    expect(await screen.findByText("That holiday was already deleted.")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryAllByRole("button", { name: "Delete Independence Day" })).toHaveLength(0),
    );
  });

  it("opens the drawer prefilled from the row's Edit action", async () => {
    renderShell();
    await loaded();
    await userEvent.click(screen.getAllByRole("button", { name: "Edit Independence Day" })[0]!);

    expect(await screen.findByText("Edit holiday")).toBeInTheDocument();
    expect(screen.getByLabelText(/Holiday name/)).toHaveValue("Independence Day");
  });
});

describe("add/edit drawer", () => {
  it("has no Type select — a control that discards its value must not ship", async () => {
    renderShell();
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: /Add holiday/ }));
    await screen.findByText("New holiday");

    expect(screen.queryByLabelText("Type")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Type" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Local name (Bangla)")).toBeInTheDocument();
  });

  it("shows the overwrite notice for a colliding date, with the import→manual sentence", async () => {
    renderShell();
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: /Add holiday/ }));
    await screen.findByText("New holiday");

    // One change event with the complete value — the controlled field reports "" for a
    // half-typed date, so per-keystroke typing never accumulates.
    fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: `26/03/${YEAR}` } });

    const notice = await screen.findByTestId("overwrite-notice");
    expect(notice).toHaveTextContent(
      `26/03/${YEAR} already has a holiday — "Independence Day". Saving replaces it.`,
    );
    // The replaced row came from the feed → the one-way door is stated.
    expect(notice).toHaveTextContent(
      "It will also become a hand-entered holiday, so future imports will leave it alone.",
    );
  });

  it("validates inline and never surfaces the server's wire-format date string", async () => {
    createHolidayMock.mockRejectedValue(
      new ApiError({
        code: "VALIDATION_ERROR",
        message: "Holiday date must be in YYYY-MM-DD format",
        status: 400,
      }),
    );
    renderShell();
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: /Add holiday/ }));
    await screen.findByText("New holiday");

    // Empty form → both inline messages, no request.
    await userEvent.click(screen.getByRole("button", { name: "Save holiday" }));
    expect(await screen.findByText("Holiday name is required.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid date.")).toBeInTheDocument();
    expect(createHolidayMock).not.toHaveBeenCalled();

    // Server rejects the date → the DD/MM/YYYY-safe message, not the wire string.
    await userEvent.type(screen.getByLabelText(/Holiday name/), "Eid Day");
    fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: `01/09/${YEAR}` } });
    await userEvent.click(screen.getByRole("button", { name: "Save holiday" }));
    await waitFor(() => expect(createHolidayMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Enter a valid date.")).toBeInTheDocument();
    expect(screen.queryByText(/YYYY-MM-DD/)).not.toBeInTheDocument();
  });
});

describe("read-only projection", () => {
  it("hides every write affordance for a role without the hr.attendance write grants", async () => {
    renderShell("ACCOUNTS_MANAGER");
    await loaded();

    expect(screen.getByTestId("holidays-read-only")).toHaveTextContent(
      "You can view the holiday calendar but not change it.",
    );
    expect(screen.queryByRole("button", { name: "Save off-days" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add holiday/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Import from API/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Import Excel/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Template/ })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /^Delete / })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: /^Edit / })).toHaveLength(0);
    // Toggles render as static state.
    expect(screen.getByRole("button", { name: "Friday" })).toBeDisabled();
  });
});
