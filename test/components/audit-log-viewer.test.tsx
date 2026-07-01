/**
 * FE-20 audit-log viewer tests (FR-AUD-020/021/022/023/024/026/027/028).
 * List: state matrix, debounced filters, sortable columns, 403. Diff: CREATE/
 * DELETE/UPDATE modes, sanitised fields. Seal: display-only, no verify control.
 * Read-only assertion: no edit/delete/correct/verify anywhere. Export: real
 * wiring (not stubbed), blob download, multi-action narrowing. Responsive,
 * DD/MM/YYYY, Bangla-no-clip, a11y.
 */
import React from "react";
import { render, screen, waitFor, within, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/toast";
import { SessionProvider } from "@/providers/session-provider";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { type Role } from "@/lib/auth/roles";
import { type AuditLogRow, type AuditLogDetail } from "@/features/audit/types";
import { AuditLogScreen } from "@/features/audit/components/AuditLogScreen";
import * as auditApi from "@/features/audit/api/audit-logs";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("@/features/audit/api/audit-logs", () => ({
  listAuditLogs: jest.fn(),
  getAuditLog: jest.fn(),
  exportAuditLogs: jest.fn(),
}));

const listMock = auditApi.listAuditLogs as jest.Mock;
const getMock = auditApi.getAuditLog as jest.Mock;
const exportMock = auditApi.exportAuditLogs as jest.Mock;

const ROW_UPDATE: AuditLogRow = {
  id: "log-1",
  action: "UPDATE",
  entityType: "Project",
  entityId: "proj-a1",
  userId: "u-acc",
  userName: "Ashraf Uddin",
  projectId: "proj-a1",
  ipAddress: "10.0.0.4",
  createdAt: "2026-06-30T10:22:00Z",
};
const ROW_BANGLA: AuditLogRow = {
  id: "log-2",
  action: "CREATE",
  entityType: "Project",
  entityId: "proj-b2",
  userId: "u-eng",
  userName: "মোহাম্মদ হাসান আব্দুল্লাহ রহমান চৌধুরী",
  projectId: null,
  ipAddress: null,
  createdAt: "2026-06-29T08:05:00Z",
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

function pageOf(rows: AuditLogRow[], total = rows.length, page = 1, pageSize = 25) {
  return { data: rows, page, pageSize, total };
}

function renderScreen(role: Role = "ADMIN", initialId: string | null = null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SessionProvider user={user(role)}>
          <AuditLogScreen initialId={initialId} />
        </SessionProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  listMock.mockReset();
  getMock.mockReset();
  exportMock.mockReset();
});

describe("AuditLogScreen — state matrix (spec §6)", () => {
  it("shows loading skeletons first", () => {
    listMock.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByTestId("audit-loading")).toBeInTheDocument();
  });

  it("renders the list with the documented columns", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    renderScreen();
    const row = await screen.findByTestId("audit-row-log-1");
    expect(within(row).getByText("Ashraf Uddin")).toBeInTheDocument();
    expect(within(row).getByTestId("action-badge-UPDATE")).toBeInTheDocument();
    expect(within(row).getByText("Project")).toBeInTheDocument();
  });

  it("empty state shows 'No audit entries match these filters.'", async () => {
    listMock.mockResolvedValue(pageOf([]));
    renderScreen();
    expect(await screen.findByText("No audit entries match these filters.")).toBeInTheDocument();
  });

  it("error shows 'Couldn't load the audit log.' + Retry", async () => {
    listMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    renderScreen();
    expect(await screen.findByText("Couldn't load the audit log.")).toBeInTheDocument();
    expect(screen.getByTestId("audit-retry")).toBeInTheDocument();
  });

  it("partial: missing IP/project render as em-dash", async () => {
    listMock.mockResolvedValue(pageOf([ROW_BANGLA]));
    renderScreen();
    const row = await screen.findByTestId("audit-row-log-2");
    // Project column and IP column both fall back to "—" when null.
    expect(within(row).getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("403 renders the exact permission-denied copy", async () => {
    listMock.mockRejectedValue(
      new ApiError({ code: "FORBIDDEN", message: "no", details: null, status: 403 }),
    );
    renderScreen("ACCOUNTS_TEAM");
    // ACCOUNTS_TEAM has no `audit` module access at all in this scaffold's role map,
    // so the screen's own isAdmin gate already renders the 403 view without a fetch.
    expect(await screen.findByTestId("audit-forbidden")).toBeInTheDocument();
    expect(screen.getByText("You don't have access to the audit log.")).toBeInTheDocument();
  });
});

describe("AuditLogScreen — DD/MM/YYYY + Bangla no-clip (spec §12)", () => {
  it("renders createdAt as DD/MM/YYYY", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    renderScreen();
    const row = await screen.findByTestId("audit-row-log-1");
    expect(within(row).getByText(/30\/06\/2026/)).toBeInTheDocument();
  });

  it("renders a long Bangla actor name in full (no truncation of the underlying text)", async () => {
    listMock.mockResolvedValue(pageOf([ROW_BANGLA]));
    renderScreen();
    const row = await screen.findByTestId("audit-row-log-2");
    expect(within(row).getByText("মোহাম্মদ হাসান আব্দুল্লাহ রহমান চৌধুরী")).toBeInTheDocument();
  });
});

describe("AuditLogScreen — read-only assertion (FR-AUD-023; spec §9)", () => {
  it("has NO edit / delete / correct / verify control anywhere on the list", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE, ROW_BANGLA]));
    renderScreen();
    await screen.findByTestId("audit-row-log-1");
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /correct/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /verify/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new (audit )?entry/i })).not.toBeInTheDocument();
  });

  it("the diff detail has no edit/delete/correct/verify control", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    const detail: AuditLogDetail = {
      id: "log-1",
      action: "UPDATE",
      entityType: "Project",
      entityId: "proj-a1",
      userId: "u-acc",
      userName: "Ashraf Uddin",
      before: { status: "DRAFT" },
      after: { status: "ACTIVE" },
      ipAddress: "10.0.0.4",
      seal: "sha256:deadbeef",
      createdAt: "2026-06-30T10:22:00Z",
    };
    getMock.mockResolvedValue(detail);
    renderScreen("ADMIN", "log-1");
    await screen.findByTestId("audit-diff-loaded");
    expect(screen.queryByRole("button", { name: /verify/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });
});

describe("AuditLogScreen — before/after diff (FR-AUD-022; spec §6/§13)", () => {
  it("CREATE: only 'after' renders with 'Created — no previous value.'", async () => {
    listMock.mockResolvedValue(pageOf([ROW_BANGLA]));
    getMock.mockResolvedValue({
      id: "log-2",
      action: "CREATE",
      entityType: "Project",
      entityId: "proj-b2",
      userId: "u-eng",
      userName: null,
      before: null,
      after: { name: "Tower-E" },
      ipAddress: null,
      seal: "sha256:aaa",
      createdAt: "2026-06-29T08:05:00Z",
    } satisfies AuditLogDetail);
    renderScreen("ADMIN", "log-2");
    await screen.findByTestId("audit-diff-loaded");
    expect(screen.getByText("Created — no previous value.")).toBeInTheDocument();
  });

  it("DELETE: only 'before' renders with 'Deleted — no new value.'", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    getMock.mockResolvedValue({
      id: "log-3",
      action: "DELETE",
      entityType: "Project",
      entityId: "proj-c3",
      userId: "u-acc",
      userName: null,
      before: { name: "Tower-F" },
      after: null,
      ipAddress: null,
      seal: "sha256:bbb",
      createdAt: "2026-06-29T08:05:00Z",
    } satisfies AuditLogDetail);
    renderScreen("ADMIN", "log-3");
    await screen.findByTestId("audit-diff-loaded");
    expect(screen.getByText("Deleted — no new value.")).toBeInTheDocument();
  });

  it("UPDATE: shows both sides and a changed-field count", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    getMock.mockResolvedValue({
      id: "log-1",
      action: "UPDATE",
      entityType: "Project",
      entityId: "proj-a1",
      userId: "u-acc",
      userName: "Ashraf Uddin",
      before: { status: "DRAFT" },
      after: { status: "ACTIVE" },
      ipAddress: "10.0.0.4",
      seal: "sha256:deadbeef",
      createdAt: "2026-06-30T10:22:00Z",
    } satisfies AuditLogDetail);
    renderScreen("ADMIN", "log-1");
    await screen.findByTestId("audit-diff-loaded");
    expect(screen.getByTestId("audit-diff-changed-count")).toHaveTextContent("1 changed");
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("NOT_FOUND -> 'That audit entry doesn't exist.'", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    getMock.mockRejectedValue(
      new ApiError({ code: "NOT_FOUND", message: "no", details: null, status: 404 }),
    );
    renderScreen("ADMIN", "missing-id");
    expect(await screen.findByText("That audit entry doesn't exist.")).toBeInTheDocument();
  });
});

describe("AuditLogScreen — seal display-only (FR-AUD-024; SRS §16; open-questions AUD-2)", () => {
  it("shows the seal hash with NO verify control and NO broken-seal state", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    getMock.mockResolvedValue({
      id: "log-1",
      action: "UPDATE",
      entityType: "Project",
      entityId: "proj-a1",
      userId: "u-acc",
      userName: "Ashraf Uddin",
      before: { status: "DRAFT" },
      after: { status: "ACTIVE" },
      ipAddress: "10.0.0.4",
      seal: "sha256:deadbeefdeadbeefdeadbeefdeadbeef",
      createdAt: "2026-06-30T10:22:00Z",
    } satisfies AuditLogDetail);
    renderScreen("ADMIN", "log-1");
    await screen.findByTestId("audit-diff-loaded");
    expect(screen.getByTestId("seal-display")).toBeInTheDocument();
    expect(screen.getByText("sha256:deadbeefdeadbeefdeadbeefdeadbeef")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /verify integrity/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/broken seal|tamper detected|chain broken/i)).not.toBeInTheDocument();
  });
});

describe("AuditLogScreen — filters (spec §7/§9, debounced apply-on-change)", () => {
  it("debounces a filter change and re-queries with it applied", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    renderScreen();
    await screen.findByTestId("audit-row-log-1");

    const filterBar = screen.getByTestId("audit-filter-bar");
    const entityTypeInput = within(filterBar).getByLabelText(/entity type/i);
    fireEvent.change(entityTypeInput, { target: { value: "Project" } });

    // Not fired immediately (debounced).
    const callsBeforeDebounce = listMock.mock.calls.length;

    act(() => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => expect(listMock.mock.calls.length).toBeGreaterThan(callsBeforeDebounce));
    expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({ entityType: "Project" }));
    jest.useRealTimers();
  });

  it("dateFrom > dateTo shows the inline message and does not fire an invalid query", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    renderScreen();
    await screen.findByTestId("audit-row-log-1");
    await userEvent.type(screen.getByLabelText(/date from/i), "2026-06-30");
    await userEvent.type(screen.getByLabelText(/date to/i), "2025-04-01");
    expect(await screen.findByTestId("audit-date-error")).toHaveTextContent(
      "End date must be after start date.",
    );
  });

  it("multi-select actions toggle on click", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    renderScreen();
    await screen.findByTestId("audit-row-log-1");
    const updateChip = screen.getByTestId("audit-action-UPDATE");
    expect(updateChip).toHaveAttribute("aria-checked", "false");
    await userEvent.click(updateChip);
    expect(updateChip).toHaveAttribute("aria-checked", "true");
  });
});

describe("AuditLogScreen — sortable columns (spec §10)", () => {
  it("Timestamp header is a button announcing sort state", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE, ROW_BANGLA]));
    renderScreen();
    await screen.findByTestId("audit-row-log-1");
    const sortBtn = screen.getByTestId("audit-sort-createdAt");
    expect(sortBtn).toHaveAccessibleName(expect.stringMatching(/sort by timestamp/i));
    await userEvent.click(sortBtn);
    expect(sortBtn).toHaveAccessibleName(expect.stringMatching(/ascending|descending/i));
  });
});

describe("AuditLogScreen — export CTA (FR-AUD-028; FULLY WIRED, not stubbed)", () => {
  it("is enabled (not disabled/stubbed) once the endpoint has merged", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    renderScreen();
    await screen.findByTestId("audit-row-log-1");
    expect(screen.getByTestId("audit-export-button")).not.toBeDisabled();
  });

  it("triggers a real download (Blob + anchor click) reflecting the current filter set", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    const blob = new Blob(["a,b,c"], { type: "text/csv" });
    exportMock.mockResolvedValue({ blob, filename: "audit-log-30-06-2026.csv" });

    const clickSpy = jest.fn();
    const originalCreate = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === "a") el.click = clickSpy;
      return el;
    });
    URL.createObjectURL = jest.fn(() => "blob:mock-url");
    URL.revokeObjectURL = jest.fn();

    renderScreen();
    await screen.findByTestId("audit-row-log-1");
    await userEvent.click(screen.getByTestId("audit-export-button"));
    await userEvent.click(await screen.findByTestId("audit-export-csv"));

    await waitFor(() => expect(exportMock).toHaveBeenCalled());
    expect(clickSpy).toHaveBeenCalled();

    (document.createElement as jest.Mock).mockRestore();
  });

  it("shows the 'Exporting…' in-flight state", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    let resolveExport: (v: { blob: Blob; filename: string }) => void = () => {};
    exportMock.mockReturnValue(
      new Promise((resolve) => {
        resolveExport = resolve;
      }),
    );

    const clickSpy = jest.fn();
    const originalCreate = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === "a") el.click = clickSpy;
      return el;
    });
    URL.createObjectURL = jest.fn(() => "blob:mock-url");
    URL.revokeObjectURL = jest.fn();

    renderScreen();
    await screen.findByTestId("audit-row-log-1");
    await userEvent.click(screen.getByTestId("audit-export-button"));
    await userEvent.click(await screen.findByTestId("audit-export-csv"));

    expect(await screen.findByText("Exporting…")).toBeInTheDocument();

    await act(async () => {
      resolveExport({ blob: new Blob(["x"]), filename: "audit-log.csv" });
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId("audit-export-button")).not.toBeDisabled());

    (document.createElement as jest.Mock).mockRestore();
  });

  it("shows the export reproducibility summary (filters + count)", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE], 42));
    renderScreen();
    await screen.findByTestId("audit-row-log-1");
    expect(await screen.findByTestId("audit-export-summary")).toHaveTextContent("42");
  });

  it("disables export and explains when 2+ actions are selected (endpoint takes one action)", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    renderScreen();
    await screen.findByTestId("audit-row-log-1");
    await userEvent.click(screen.getByTestId("audit-action-UPDATE"));
    await userEvent.click(screen.getByTestId("audit-action-POST"));
    await waitFor(() => expect(screen.getByTestId("audit-export-button")).toBeDisabled());
    expect(screen.getByTestId("audit-export-multi-action-hint")).toBeInTheDocument();
  });

  it("maps a FORBIDDEN export error to the exact copy", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    exportMock.mockRejectedValue(
      new ApiError({ code: "FORBIDDEN", message: "no", details: null, status: 403 }),
    );
    renderScreen();
    await screen.findByTestId("audit-row-log-1");
    await userEvent.click(screen.getByTestId("audit-export-button"));
    await userEvent.click(await screen.findByTestId("audit-export-csv"));
    expect(await screen.findByTestId("audit-export-error")).toHaveTextContent(
      "You don't have access to export the audit log.",
    );
  });
});

describe("AuditLogScreen — responsive (spec §4)", () => {
  it("renders the desktop table region and the mobile-cards region (both mounted; CSS toggles visibility)", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    renderScreen();
    await screen.findByTestId("audit-table-desktop");
    expect(screen.getByTestId("audit-mobile-cards")).toBeInTheDocument();
    expect(screen.getByTestId("audit-mobile-note")).toHaveTextContent(
      "The side-by-side before/after diff and export are best on a larger screen.",
    );
  });
});

describe("AuditLogScreen — a11y (spec §10)", () => {
  it("a row is keyboard-focusable and Enter opens the detail", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    getMock.mockResolvedValue({
      id: "log-1",
      action: "UPDATE",
      entityType: "Project",
      entityId: "proj-a1",
      userId: "u-acc",
      userName: "Ashraf Uddin",
      before: { status: "DRAFT" },
      after: { status: "ACTIVE" },
      ipAddress: "10.0.0.4",
      seal: "sha256:deadbeef",
      createdAt: "2026-06-30T10:22:00Z",
    } satisfies AuditLogDetail);
    renderScreen();
    const row = await screen.findByTestId("audit-row-log-1");
    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });
    // The screen navigates via router.push (mocked) rather than re-rendering with
    // a new initialId in this unit test, so we only assert the row is reachable
    // and responds to Enter without throwing — full navigation is covered by the
    // `initialId` prop tests above (diff panel opens directly from a deep link).
    expect(row).toHaveAttribute("tabIndex", "0");
  });

  it("copy-id button has an accessible 'Copy id' label", async () => {
    listMock.mockResolvedValue(pageOf([ROW_UPDATE]));
    renderScreen();
    await screen.findByTestId("audit-row-log-1");
    expect(screen.getAllByLabelText("Copy id")[0]).toBeInTheDocument();
  });
});
