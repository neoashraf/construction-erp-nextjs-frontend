/**
 * Export menu + year-picker rendering.
 *
 * Covers two UI defects: the export items rendered as a run-together block because the
 * shared `DropdownMenuItem` is a fixed-height single-line row, and both year pickers were
 * capped to a narrow hardcoded window that made a year like 2028 unreachable.
 */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/components/ui/toast";
import { ExportMenu } from "@/features/hr/components/ExportMenu";
import { AttendanceLogFilterBar } from "@/features/hr/components/AttendanceLogFilterBar";
import { initialDraft } from "@/features/hr/lib/attendance-filters";

// Stub the network + the browser download so the test exercises the CLICK path only.
jest.mock("@/features/hr/api/attendance-logs", () => ({
  fetchExportCsv: jest.fn().mockResolvedValue("A,B\r\n1,2"),
}));
jest.mock("@/features/hr/lib/attendance-export", () => ({
  downloadCsvAsXlsx: jest.fn().mockResolvedValue(undefined),
}));

function renderExportMenu() {
  return render(
    <ToastProvider>
      <ExportMenu filters={{ dateFrom: "2026-07-01", dateTo: "2026-07-31" }} suggested="range" />
    </ToastProvider>,
  );
}

describe("ExportMenu", () => {
  it("offers all three export types regardless of the current view", async () => {
    const user = userEvent.setup();
    renderExportMenu();
    await user.click(screen.getByTestId("export-menu"));

    const items = await screen.findAllByRole("menuitem");
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining("Summary totals"),
      expect.stringContaining("Detailed day-by-day"),
      expect.stringContaining("Single day"),
    ]);
  });

  it("marks only the suggested type, without disabling the others", async () => {
    const user = userEvent.setup();
    renderExportMenu();
    await user.click(screen.getByTestId("export-menu"));

    const items = await screen.findAllByRole("menuitem");
    const suggested = items.filter((i) => within(i).queryByText("Suggested"));
    expect(suggested).toHaveLength(1);
    expect(suggested[0]).toHaveTextContent("Detailed day-by-day");
    for (const item of items) expect(item).not.toHaveAttribute("data-disabled");
  });

  it("lets each item grow to fit its two lines instead of the fixed row height", async () => {
    const user = userEvent.setup();
    renderExportMenu();
    await user.click(screen.getByTestId("export-menu"));

    // h-auto must override the primitive's h-[34px], or label and hint collide.
    for (const item of await screen.findAllByRole("menuitem")) {
      expect(item.className).toContain("h-auto");
      expect(item.className).toContain("flex-col");
      expect(item.className).not.toMatch(/(^|\s)items-center(\s|$)/);
    }
  });

  it("renders the label above its hint, each on its own line", async () => {
    const user = userEvent.setup();
    renderExportMenu();
    await user.click(screen.getByTestId("export-menu"));

    const summary = (await screen.findAllByRole("menuitem"))[0]!;
    const label = within(summary).getByText("Summary totals");
    const hint = within(summary).getByText("One row per employee");
    // The hint must be quieter than the label — the original bug read as the reverse.
    expect(label.className).toContain("font-semibold");
    expect(hint.className).toContain("text-muted-foreground");
    expect(label.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("year picker", () => {
  it("can reach years well beyond the current one", async () => {
    const user = userEvent.setup();
    const onDraftChange = jest.fn();
    const draft = initialDraft(new Date(2026, 6, 15));
    render(
      <AttendanceLogFilterBar
        draft={draft}
        onDraftChange={onDraftChange}
        onModeChange={jest.fn()}
        onApply={jest.fn()}
        onClear={jest.fn()}
        onToggleSummary={jest.fn()}
        canSummarize
        showClear={false}
      />,
    );

    const yearSelect = screen.getByLabelText("Year");
    const options = within(yearSelect).getAllByRole("option").map((o) => o.textContent);
    // The reported gap: 2028 was simply not in the list.
    expect(options).toContain("2028");
    expect(options).toContain("2021");

    // Controlled select: picking 2028 reports the new month bounds upward.
    await user.selectOptions(yearSelect, "2028");
    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom: "2028-07-01", dateTo: "2028-07-31" }),
    );
  });
});

describe("ExportMenu — click behaviour", () => {
  const api = jest.requireMock("@/features/hr/api/attendance-logs") as {
    fetchExportCsv: jest.Mock;
  };

  it("actually calls the export endpoint when an item is chosen", async () => {
    const user = userEvent.setup();
    renderExportMenu();
    await user.click(screen.getByTestId("export-menu"));
    await user.click(await screen.findByText("Summary totals"));

    await waitFor(() => expect(api.fetchExportCsv).toHaveBeenCalledTimes(1));
    expect(api.fetchExportCsv).toHaveBeenCalledWith(
      "summary",
      expect.objectContaining({ dateFrom: "2026-07-01", dateTo: "2026-07-31" }),
    );
  });
});
