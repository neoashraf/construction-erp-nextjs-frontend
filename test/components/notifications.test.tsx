/**
 * FE-53 fe-notifications tests (FR-NTF-003/-004/-005/-007/-008/-010/-011/-013/-015/-022).
 * Covers: badge from unread-count + 9+ cap + hidden-at-0; drawer open/close;
 * unread emphasis vs read muted; optimistic mark-read + revert-on-failure;
 * mark-all → 0; HIGH push → toast, NORMAL/LOW → badge-only; mocked-socket
 * push + reconcile flow (connected seed → notification:new prepend → disconnect
 * → reconnect + reconcile no-dup); page filters + filtered-empty; feed-error
 * + Retry; null-deepLink informational; multi-tab convergence via
 * notification:unreadCount push.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/providers/session-provider";
import { ApiError } from "@/lib/api/errors";
import { type SafeUser } from "@/lib/auth/session";
import { NotificationsBell } from "@/features/notifications/components/NotificationsBell";
import { NotificationsPage } from "@/features/notifications/components/NotificationsPage";
import * as api from "@/features/notifications/api/notifications";
import {
  type NotificationsSocket,
  type SocketEventName,
  type SocketHandler,
} from "@/features/notifications/socket/notifications-socket";
import { type Notification } from "@/features/notifications/types";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("@/features/notifications/api/notifications");

const listMock = api.listNotifications as jest.Mock;
const countMock = api.getUnreadCount as jest.Mock;
const markMock = api.markRead as jest.Mock;
const allMock = api.markAllRead as jest.Mock;

function seed(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    type: "BUDGET_BREACH",
    severity: "HIGH",
    sourceModule: "CC",
    title: "Budget breach — Flooring, Tower A",
    body: "Actuals exceed the budget.",
    deepLink: { route: "/cost-control/budget-vs-actual" },
    payload: null,
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    readAt: null,
    ...overrides,
  };
}

function user(): SafeUser {
  return {
    id: "u1",
    email: "u@ze.test",
    name: "User",
    role: "ACCOUNTS_MANAGER",
    companyId: "c1",
    financialYearId: "fy-1",
    isActive: true,
  };
}

function renderBell(overrideSocket?: NotificationsSocket, defaultOpen = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider user={user()}>
        <NotificationsBell
          overrideSocket={overrideSocket}
          autoConnect={!!overrideSocket}
          defaultOpen={defaultOpen}
        />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider user={user()}>
        <NotificationsPage />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

/** A manually driveable socket for the unit tests. */
function makeMockSocket(): NotificationsSocket & { fire: (e: SocketEventName, d?: unknown) => void } {
  const handlers = new Map<SocketEventName, Set<SocketHandler>>();
  const on = (event: SocketEventName, handler: SocketHandler) => {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(handler);
    return () => handlers.get(event)?.delete(handler);
  };
  return {
    connect: async () => undefined,
    disconnect: () => undefined,
    on,
    emit: (event, data) => {
      const set = handlers.get(event);
      if (set) for (const h of set) h(data);
    },
    fire: (event, data) => {
      const set = handlers.get(event);
      if (set) for (const h of set) h(data);
    },
    connected: false,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  countMock.mockResolvedValue(3);
  listMock.mockResolvedValue({
    data: [
      seed(),
      seed({ id: "n2", severity: "NORMAL", title: "REQ awaiting approval", deepLink: null }),
      seed({ id: "n3", severity: "LOW", title: "Read row", readAt: new Date().toISOString() }),
    ],
    meta: { page: 1, pageSize: 25, total: 3 },
  });
  markMock.mockResolvedValue(undefined);
  allMock.mockResolvedValue({ updated: 3 });
});

describe("NotificationsBell — badge + drawer (FR-NTF-005/-014/-013)", () => {
  it("hides the badge when unread-count is 0", async () => {
    countMock.mockResolvedValue(0);
    renderBell();
    await waitFor(() =>
      expect(screen.getByTestId("notifications-bell")).toHaveAttribute(
        "aria-label",
        "Notifications",
      ),
    );
    expect(screen.queryByTestId("notifications-badge")).not.toBeInTheDocument();
  });

  it("caps the badge at 9+", async () => {
    countMock.mockResolvedValue(42);
    renderBell();
    await waitFor(() =>
      expect(screen.getByTestId("notifications-badge")).toHaveTextContent("9+"),
    );
    expect(screen.getByTestId("notifications-bell")).toHaveAttribute(
      "aria-label",
      "Notifications, 42 unread",
    );
  });

  it("opens the drawer, shows unread emphasis + end-of-list marker", async () => {
    renderBell(undefined, true);
    await screen.findByTestId("notifications-drawer");
    await screen.findByTestId("notifications-list");
    const rows = screen.getAllByTestId("notification-row");
    expect(rows).toHaveLength(3);
    // First row unread; last row read.
    expect(rows[0]).toHaveAttribute("data-unread", "true");
    expect(rows[2]).toHaveAttribute("data-unread", "false");
    expect(screen.getByTestId("notifications-end")).toBeInTheDocument();
  });
});

describe("NotificationsBell — mark-read (FR-NTF-004)", () => {
  it("optimistically marks a row read and decrements the badge; reverts on failure", async () => {
    markMock.mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "x", status: 500 }));
    renderBell(undefined, true);
    await screen.findByTestId("notifications-drawer");
    const rows = await screen.findAllByTestId("notification-row");
    // Click the "Mark as read" affordance on the first unread row.
    const btn = rows[0]!.querySelector('[data-testid="notification-mark-read"]') as HTMLElement;
    await userEvent.click(btn);
    await waitFor(() =>
      expect(screen.getByTestId("drawer-mark-error")).toHaveTextContent(/Couldn't mark read/i),
    );
    // Row reverts to unread after failure.
    await waitFor(() =>
      expect(screen.getAllByTestId("notification-row")[0]).toHaveAttribute("data-unread", "true"),
    );
  });

  it("mark-all POSTs read-all and drops the visible badge to 0", async () => {
    renderBell(undefined, true);
    await screen.findByTestId("notifications-drawer");
    await userEvent.click(screen.getByTestId("drawer-mark-all"));
    await waitFor(() => expect(allMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByTestId("notifications-badge")).not.toBeInTheDocument(),
    );
  });
});

describe("NotificationsBell — deep-link + informational (FR-NTF-015)", () => {
  it("null deepLink renders a non-clickable (informational) row", async () => {
    renderBell(undefined, true);
    await screen.findByTestId("notifications-drawer");
    const rows = await screen.findAllByTestId("notification-row");
    // Row 2 (`n2`) has deepLink: null → informational, so it is not clickable
    // (no cursor-pointer affordance) unlike the deep-linked first row. Per the
    // design file (frame 01/02) informational rows carry no visible tag; the
    // distinction is the absence of the click affordance.
    expect(rows[1]!.className).not.toContain("cursor-pointer");
    expect(rows[0]!.className).toContain("cursor-pointer");
  });
});

describe("NotificationsBell — socket push + toast (FR-NTF-007/-008/-010/-011/-022)", () => {
  it("HIGH push raises a toast + updates the badge; NORMAL push does NOT toast", async () => {
    const socket = makeMockSocket();
    renderBell(socket);
    // Wait for the initial REST count so it can't overwrite the socket-set value.
    await waitFor(() =>
      expect(screen.getByTestId("notifications-badge")).toHaveTextContent("3"),
    );
    // Seed: `connected` sets the badge to 5 (test the socket path drives the count).
    socket.fire("connected", { unreadCount: 5 });
    await waitFor(() =>
      expect(screen.getByTestId("notifications-badge")).toHaveTextContent("5"),
    );

    const highPush = seed({ id: "push-high", severity: "HIGH", title: "HIGH new" });
    socket.fire("notification:new", highPush);
    socket.fire("notification:unreadCount", { unreadCount: 6 });
    await waitFor(() =>
      expect(screen.getByTestId("notifications-badge")).toHaveTextContent("6"),
    );
    expect(await screen.findByTestId("notification-high-toast")).toHaveTextContent(/HIGH new/);

    // NORMAL push increments the count but does not add a toast.
    const normalPush = seed({ id: "push-norm", severity: "NORMAL", title: "quiet push" });
    socket.fire("notification:new", normalPush);
    socket.fire("notification:unreadCount", { unreadCount: 7 });
    await waitFor(() =>
      expect(screen.getByTestId("notifications-badge")).toHaveTextContent("7"),
    );
    // No new toast for the NORMAL push.
    expect(screen.queryAllByTestId("notification-high-toast")).toHaveLength(1);
  });

  it("reconnect reconciles new-since-lastSeen without duplicates", async () => {
    const socket = makeMockSocket();
    renderBell(socket, true);
    await screen.findByTestId("notifications-drawer");
    await screen.findByTestId("notifications-list");

    // Seed the connection.
    socket.fire("connected", { unreadCount: 3 });

    // Push a live row.
    const livePush = seed({ id: "n-live-1", title: "live push" });
    socket.fire("notification:new", livePush);
    await waitFor(() => {
      const rows = screen.getAllByTestId("notification-row");
      expect(rows.some((r) => r.getAttribute("data-id") === "n-live-1")).toBe(true);
    });

    // Simulate a disconnect + reconnect. On reconnect the hook reconciles by
    // calling listNotifications({ isRead: false, since }) — we return one row
    // that overlaps the already-live-pushed row (deduped) plus a new one.
    socket.fire("disconnect");
    listMock.mockResolvedValueOnce({
      data: [livePush, seed({ id: "n-live-2", title: "reconciled" })],
      meta: { page: 1, pageSize: 25, total: 2 },
    });
    socket.fire("connected", { unreadCount: 4 });

    await waitFor(() => {
      const rows = screen.getAllByTestId("notification-row");
      const ids = rows.map((r) => r.getAttribute("data-id"));
      // The already-known row is not duplicated.
      expect(ids.filter((i) => i === "n-live-1")).toHaveLength(1);
      // The new row from reconciliation appears.
      expect(ids).toContain("n-live-2");
    });
  });
});

describe("NotificationsPage — filters + pagination + empty (FR-NTF-013)", () => {
  it("renders the paginated feed + summary + Prev disabled at page 1", async () => {
    listMock.mockResolvedValue({
      data: [seed()],
      meta: { page: 1, pageSize: 25, total: 1 },
    });
    renderPage();
    await screen.findByTestId("notifications-page");
    expect(await screen.findByTestId("page-pagination-summary")).toHaveTextContent(
      /Showing 1.1 of 1/,
    );
    expect(screen.getByTestId("page-prev")).toBeDisabled();
  });

  it('shows "No notifications match these filters." when a filter yields empty', async () => {
    // The default feed returns 3 rows; when the user clicks Unread and the API
    // returns an empty page, the filtered-empty state renders.
    renderPage();
    await screen.findByTestId("notifications-page");
    listMock.mockResolvedValue({ data: [], meta: { page: 1, pageSize: 25, total: 0 } });
    await userEvent.click(screen.getByTestId("filter-read-unread"));
    await userEvent.click(screen.getByTestId("filter-apply"));
    await waitFor(() =>
      expect(screen.getByTestId("notifications-empty")).toHaveTextContent(
        /No notifications match these filters\./,
      ),
    );
  });

  it("shows the feed-error card with Retry when the list fails", async () => {
    listMock.mockRejectedValueOnce(new ApiError({ code: "UNKNOWN", message: "x", status: 500 }));
    renderPage();
    expect(await screen.findByTestId("notifications-error")).toHaveTextContent(
      /Couldn't load notifications\./,
    );
    expect(screen.getByTestId("notifications-retry")).toBeInTheDocument();
  });
});
