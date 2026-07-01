/**
 * FE-14 numbering-series component tests (FR-NUM-001/002/013/018/019/020/021/022).
 * State matrix, read-only lastSequence, no Add-series CTA, Admin-only 403, editor
 * validation + save + IMMUTABLE_FIELD mapping, forward-only banner, live preview,
 * discard confirm, and the gap-audit continuous / gap-detected panel.
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
import { type NumberingSeries, type GapAudit } from "@/features/numbering/types";
import { NumberingSeriesScreen } from "@/features/numbering/components/NumberingSeriesScreen";
import { SeriesEditorDrawer } from "@/features/numbering/components/SeriesEditorDrawer";
import { GapAuditPanel } from "@/features/numbering/components/GapAuditPanel";
import * as api from "@/features/numbering/api/numbering-series";

jest.mock("@/features/numbering/api/numbering-series", () => ({
  listNumberingSeries: jest.fn(),
  updateNumberingSeries: jest.fn(),
  getNextPreview: jest.fn(),
  getGapAudit: jest.fn(),
}));

const listMock = api.listNumberingSeries as jest.Mock;
const updateMock = api.updateNumberingSeries as jest.Mock;
const gapMock = api.getGapAudit as jest.Mock;

const IPC: NumberingSeries = {
  id: "s1",
  companyId: "c1",
  financialYearId: "fy1",
  voucherType: "SALES_IPC",
  prefix: "IPC",
  paddingWidth: 4,
  lastSequence: 41,
  nextNumberPreview: "IPC/2526/0042",
};
const DLA: NumberingSeries = {
  id: "s2",
  companyId: "c1",
  financialYearId: "fy1",
  voucherType: "DAILY_LABOUR_ACCRUAL",
  prefix: "DLA",
  paddingWidth: 4,
  lastSequence: 9999, // next = 10000 → grows past 4 digits
  nextNumberPreview: "DLA/2526/10000",
};

const CONTINUOUS: GapAudit = {
  seriesId: "s1",
  voucherType: "SALES_IPC",
  lowestSequence: 1,
  highestSequence: 42,
  committedCount: 42,
  expectedCount: 42,
  continuous: true,
  integrityAlert: false,
};
const GAP: GapAudit = {
  seriesId: "s1",
  voucherType: "JOURNAL",
  lowestSequence: 1,
  highestSequence: 55,
  committedCount: 53,
  expectedCount: 55,
  continuous: false,
  integrityAlert: true,
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
function pageOf(...s: NumberingSeries[]) {
  return { data: s, page: 1, pageSize: 100, total: s.length };
}
function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}
function renderScreen(role: Role = "ADMIN") {
  return render(
    <QueryClientProvider client={client()}>
      <SessionProvider user={user(role)}>
        <ToastProvider>
          <NumberingSeriesScreen />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
}
function renderNode(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={client()}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  listMock.mockReset();
  updateMock.mockReset();
  gapMock.mockReset();
  gapMock.mockResolvedValue(CONTINUOUS); // default so the row continuity badge resolves
});

describe("NumberingSeriesScreen — state matrix + fields", () => {
  it("shows loading skeletons first", () => {
    listMock.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByTestId("series-loading")).toBeInTheDocument();
  });

  it("renders series header fields incl. read-only last sequence + composed sample (FR-NUM-013/019)", async () => {
    listMock.mockResolvedValue(pageOf(IPC));
    renderScreen();
    const row = await screen.findByTestId("series-row-SALES_IPC");
    expect(within(row).getByText("Sales / IPC bill")).toBeInTheDocument();
    expect(within(row).getByText("IPC")).toBeInTheDocument();
    expect(within(row).getByText("41")).toBeInTheDocument(); // last sequence, read-only
    expect(within(row).getByTestId("series-next-SALES_IPC")).toHaveTextContent("IPC/2526/0042");
  });

  it("renders a full-length sample when the sequence grows past the padding width (SRS §11 EC8)", async () => {
    listMock.mockResolvedValue(pageOf(DLA));
    renderScreen();
    const row = await screen.findByTestId("series-row-DAILY_LABOUR_ACCRUAL");
    expect(within(row).getByTestId("series-next-DAILY_LABOUR_ACCRUAL")).toHaveTextContent(
      "DLA/2526/10000",
    );
    expect(within(row).getByText(/grown past 4 digits/i)).toBeInTheDocument();
  });

  it("empty state has NO 'Add series' CTA (SRS §16)", async () => {
    listMock.mockResolvedValue(pageOf());
    renderScreen();
    expect(
      await screen.findByText(/No numbering series for this company and financial year yet/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add series/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new series/i })).not.toBeInTheDocument();
  });

  it("error shows Retry", async () => {
    listMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "boom", details: null, status: 500 }),
    );
    renderScreen();
    expect(await screen.findByText("Couldn't load numbering series.")).toBeInTheDocument();
    expect(screen.getByTestId("series-retry")).toBeInTheDocument();
  });

  it("continuity badge resolves per row from the gap audit (FR-NUM-021)", async () => {
    listMock.mockResolvedValue(pageOf(IPC));
    renderScreen();
    const desktop = await screen.findByTestId("series-desktop");
    expect(await within(desktop).findByTestId("continuity-ok-s1")).toHaveTextContent(
      "Continuous",
    );
  });
});

describe("NumberingSeriesScreen — Admin-only (spec §11)", () => {
  it("non-Admin sees the 403 view and no rows", async () => {
    listMock.mockResolvedValue(pageOf(IPC));
    renderScreen("ACCOUNTS_TEAM");
    expect(
      await screen.findByText("You don't have permission to view numbering series."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("series-row-SALES_IPC")).not.toBeInTheDocument();
  });

  it("Admin sees the row actions (kebab)", async () => {
    listMock.mockResolvedValue(pageOf(IPC));
    renderScreen("ADMIN");
    expect(await screen.findByTestId("series-actions-SALES_IPC")).toBeInTheDocument();
  });
});

describe("SeriesEditorDrawer — edit (FR-NUM-002/013/018/020)", () => {
  const noop = () => {};
  function renderEditor(overrides?: Partial<Parameters<typeof SeriesEditorDrawer>[0]>) {
    return renderNode(
      <SeriesEditorDrawer
        series={IPC}
        fyLabelText="FY (2526)"
        initialTab="edit"
        onClose={overrides?.onClose ?? noop}
        onSaved={overrides?.onSaved ?? noop}
        onError={overrides?.onError ?? noop}
      />,
    );
  }

  it("shows the always-visible forward-only warning + read-only last sequence", async () => {
    renderEditor();
    expect(await screen.findByTestId("forward-only-warning")).toHaveTextContent(
      /apply to.*future.*numbers only/i,
    );
    expect(screen.getByText(/Last sequence advances only when a voucher is posted/i)).toBeInTheDocument();
  });

  it("live preview recomputes as the prefix is edited (aria-live)", async () => {
    renderEditor();
    const preview = await screen.findByTestId("series-preview");
    expect(preview).toHaveTextContent("IPC/2526/0042");
    const prefix = screen.getByLabelText(/prefix/i);
    await userEvent.clear(prefix);
    await userEvent.type(prefix, "IPCX");
    expect(await screen.findByTestId("series-preview")).toHaveTextContent("IPCX/2526/0042");
  });

  it("prefix '/' is rejected inline; save not called", async () => {
    renderEditor();
    const prefix = await screen.findByLabelText(/prefix/i);
    await userEvent.clear(prefix);
    await userEvent.type(prefix, "IPC/A");
    await userEvent.click(screen.getByTestId("series-save"));
    expect(await screen.findByTestId("series-prefix-error")).toHaveTextContent(
      "Use only letters, digits and - _ — no /.",
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("saves prefix + paddingWidth (server-confirmed) and reports success", async () => {
    updateMock.mockResolvedValue({ ...IPC, prefix: "IPC-A" });
    const onSaved = jest.fn();
    renderEditor({ onSaved });
    const prefix = await screen.findByLabelText(/prefix/i);
    await userEvent.clear(prefix);
    await userEvent.type(prefix, "IPC-A");
    await userEvent.click(screen.getByTestId("series-save"));
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith("s1", { prefix: "IPC-A", paddingWidth: 4 }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("maps IMMUTABLE_FIELD to the read-only message via onError (FR-NUM-018)", async () => {
    updateMock.mockRejectedValue(
      new ApiError({ code: "IMMUTABLE_FIELD", message: "no", details: null, status: 409 }),
    );
    const onError = jest.fn();
    renderEditor({ onError });
    const prefix = await screen.findByLabelText(/prefix/i);
    await userEvent.clear(prefix);
    await userEvent.type(prefix, "IPC-A");
    await userEvent.click(screen.getByTestId("series-save"));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        "Last sequence can't be edited — it advances only when a voucher posts.",
      ),
    );
  });

  it("Cancel with unsaved edits opens the discard confirm; Keep editing dismisses", async () => {
    const onClose = jest.fn();
    renderEditor({ onClose });
    const prefix = await screen.findByLabelText(/prefix/i);
    await userEvent.type(prefix, "Z"); // dirty
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(await screen.findByTestId("discard-changes-dialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("keep-editing"));
    await waitFor(() =>
      expect(screen.queryByTestId("discard-changes-dialog")).not.toBeInTheDocument(),
    );
  });

  it("Cancel with no edits closes directly (no confirm)", async () => {
    const onClose = jest.fn();
    renderEditor({ onClose });
    await screen.findByTestId("series-edit-form");
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByTestId("discard-changes-dialog")).not.toBeInTheDocument();
  });
});

describe("GapAuditPanel (FR-NUM-021, spec §6)", () => {
  it("renders the Continuous status with counts", async () => {
    gapMock.mockResolvedValue(CONTINUOUS);
    renderNode(<GapAuditPanel series={IPC} />);
    expect(await screen.findByTestId("gap-audit-continuous")).toHaveTextContent(
      /Continuous — no gaps/i,
    );
  });

  it("renders the Gap detected alert (role=alert) with committed vs expected", async () => {
    gapMock.mockResolvedValue(GAP);
    renderNode(<GapAuditPanel series={IPC} />);
    const alert = await screen.findByTestId("gap-audit-alert");
    expect(alert).toHaveTextContent("Gap detected.");
    expect(alert).toHaveTextContent(/53 committed but 55 expected/i);
    // no fix/remediation control
    expect(screen.queryByRole("button", { name: /fix/i })).not.toBeInTheDocument();
  });

  it("gap-audit error shows Retry", async () => {
    gapMock.mockRejectedValue(
      new ApiError({ code: "UNKNOWN", message: "x", details: null, status: 500 }),
    );
    renderNode(<GapAuditPanel series={IPC} />);
    expect(await screen.findByText("Couldn't run the gap audit.")).toBeInTheDocument();
    expect(screen.getByTestId("gap-audit-retry")).toBeInTheDocument();
  });
});
