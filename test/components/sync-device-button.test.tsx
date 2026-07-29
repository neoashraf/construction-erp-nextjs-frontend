/**
 * Sync button layout: a long sync result must never widen the header row.
 *
 * Regression — the outcome used to render as a flex sibling of the button, so a message like
 * "Nothing reached the reports — 143 day(s) blocked (…)" stretched the row and pushed the
 * header buttons out of place.
 *
 * The mocked run below is `reconciled: 0` with a non-empty `skippedReasons`, which FE-64 routes
 * to the caller's persistent `role="alert"` (FR-HR-008a) INSTEAD of a toast — a toast
 * disappears, and a run that reached no report needs an action, not a notice. Either way the
 * outcome text stays out of the button row, which is what this file exists to protect.
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

function renderBtn(onComplete?: (summary: unknown) => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <div data-testid="header" style={{ display: "flex" }}>
          <SyncDeviceButton onComplete={onComplete} />
        </div>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("SyncDeviceButton layout", () => {
  it("keeps the result OUT of the button row", async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();
    renderBtn(onComplete);

    const row = screen.getByTestId("sync-device").parentElement!;
    const before = row.textContent;

    await user.click(screen.getByTestId("sync-device"));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());

    // Whatever channel the outcome takes, it never renders as a flex sibling of the button.
    expect(row.textContent).toBe(before);
    expect(row).not.toHaveTextContent(/blocked|Nothing reached the reports/);
  });

  it("hands the run to the caller and suppresses the toast when nothing reconciled", async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();
    renderBtn(onComplete);

    await user.click(screen.getByTestId("sync-device"));

    // FR-HR-008a: the caller raises a persistent `role="alert"` from this summary. A success
    // toast here would present a run that reached NO report as a success — the failure whose
    // symptom (people paid as absent) only surfaces weeks later, in payroll.
    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ reconciled: 0, skippedReasons: { NO_FINANCIAL_YEAR: 143 } }),
      ),
    );
    expect(screen.queryByText(/Nothing reached the reports/)).not.toBeInTheDocument();
  });
});
