/**
 * Sync button layout: a long sync result must never widen the header row.
 * Regression — the outcome used to render as a flex sibling of the button, so a message like
 * "Nothing reached the reports — 143 day(s) blocked (…)" stretched the row and pushed the
 * header buttons out of place.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/toast";
import { SyncDeviceButton } from "@/features/hr/components/SyncDeviceButton";

jest.mock("@/features/hr/hooks/useAttendanceLogs", () => {
  const actual = jest.requireActual("@/features/hr/hooks/useAttendanceLogs");
  return {
    ...actual,
    useSyncStatus: () => ({ data: undefined }),
    useRunSync: (onSuccess: (s: unknown) => void) => ({
      isPending: false,
      error: null,
      mutate: () =>
        onSuccess({
          mode: "pull",
          users: { fetched: 0, created: 0, updated: 0, unchanged: 0, skipped: 0 },
          attendance: { fetched: 0, inserted: 0, duplicates: 0, skipped: 0 },
          unnamedUsers: 0,
          durationMs: 1,
          reconciled: 0,
          skippedReasons: { NO_FINANCIAL_YEAR: 143 },
        }),
    }),
  };
});

function renderBtn() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <div data-testid="header" style={{ display: "flex" }}>
          <SyncDeviceButton />
        </div>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("SyncDeviceButton layout", () => {
  it("keeps the result OUT of the button row — it goes to a toast", async () => {
    const user = userEvent.setup();
    renderBtn();

    const row = screen.getByTestId("sync-device").parentElement!;
    const before = row.textContent;

    await user.click(screen.getByTestId("sync-device"));

    // The long outcome appears as a toast, not inside the row.
    await waitFor(() =>
      expect(screen.getByText(/Nothing reached the reports/)).toBeInTheDocument(),
    );
    expect(row.textContent).toBe(before);
    expect(row).not.toHaveTextContent(/blocked/);
  });
});
