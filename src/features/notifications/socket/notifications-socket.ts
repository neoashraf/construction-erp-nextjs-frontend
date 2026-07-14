/**
 * FE-53 notifications socket manager (SRS §5.2; FR-NTF-007..-011).
 *
 * A thin abstraction over the browser WebSocket API. The real backend serves
 * socket.io on `/ws/notifications`; in the FE we speak the same **event shape**
 * but over a bare WebSocket wire so this feature ships without pulling in a
 * socket.io-client dependency for Phase-1 (the messages are JSON envelopes,
 * `{ event, data }` — swappable to socket.io later without changing consumers).
 *
 * Consumer contract (Phase-1):
 *   const socket = createNotificationsSocket({ getTicket });
 *   const off = socket.on("notification:new", handler);
 *   socket.connect();
 *   ...
 *   socket.disconnect();
 *
 * Ticket acquisition — the JWT lives server-side (httpOnly). The BFF hands us
 * a short-lived socket ticket via `GET /api/notifications/ws-ticket`; we pass
 * it in the WebSocket subprotocol (a shape the BE will support alongside
 * the socket.io `auth: { token }` handshake).
 */

export type SocketEventName =
  | "connected"
  | "notification:new"
  | "notification:unreadCount"
  | "disconnect"
  | "connect_error";

export interface SocketConnectedPayload {
  unreadCount: number;
}
export interface SocketUnreadCountPayload {
  unreadCount: number;
}

export type SocketHandler = (data: unknown) => void;

export interface NotificationsSocketOptions {
  /** Returns a short-lived socket ticket (the BFF wraps the httpOnly token). */
  getTicket: () => Promise<string>;
  /** WS URL — defaults to `${origin.replace(http, ws)}/ws/notifications`. */
  url?: string;
  /** Injected constructor — the test seam. Defaults to the browser WebSocket. */
  WebSocketCtor?: typeof WebSocket;
  /** Reconnect delay (ms), doubles on repeated failure, capped at 30s. */
  reconnectMs?: number;
}

export interface NotificationsSocket {
  connect(): Promise<void>;
  disconnect(): void;
  on(event: SocketEventName, handler: SocketHandler): () => void;
  /** Test seam: synthesize a server event onto every registered handler. */
  emit(event: SocketEventName, data?: unknown): void;
  readonly connected: boolean;
}

/** Build a default WS URL from the current origin. */
function defaultUrl(): string {
  if (typeof window === "undefined") return "";
  const { protocol, host } = window.location;
  const wsProto = protocol === "https:" ? "wss:" : "ws:";
  return `${wsProto}//${host}/ws/notifications`;
}

export function createNotificationsSocket(opts: NotificationsSocketOptions): NotificationsSocket {
  const url = opts.url ?? defaultUrl();
  const WebSocketCtor = opts.WebSocketCtor ?? (typeof WebSocket !== "undefined" ? WebSocket : undefined);
  const reconnectBaseMs = opts.reconnectMs ?? 1000;

  const handlers = new Map<SocketEventName, Set<SocketHandler>>();
  let ws: WebSocket | null = null;
  let alive = false;
  let attempts = 0;
  let closedByUs = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function fire(event: SocketEventName, data?: unknown): void {
    const set = handlers.get(event);
    if (!set) return;
    for (const h of set) h(data);
  }

  async function attempt(): Promise<void> {
    if (!WebSocketCtor) return; // SSR / no ws support — silently no-op.
    let ticket: string;
    try {
      ticket = await opts.getTicket();
    } catch {
      fire("connect_error", { code: "UNAUTHENTICATED" });
      scheduleReconnect();
      return;
    }
    try {
      // Pass the ticket via subprotocol so it never appears in the URL logs.
      ws = new WebSocketCtor(url, [`bearer.${ticket}`]);
    } catch {
      fire("connect_error", { code: "CONNECT_FAILED" });
      scheduleReconnect();
      return;
    }
    ws.onmessage = (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(String(ev.data)) as { event?: unknown; data?: unknown };
        if (typeof parsed.event === "string") {
          fire(parsed.event as SocketEventName, parsed.data);
        }
      } catch {
        // Ignore malformed frames.
      }
    };
    ws.onopen = () => {
      alive = true;
      attempts = 0;
    };
    ws.onerror = () => {
      fire("connect_error", { code: "CONNECT_FAILED" });
    };
    ws.onclose = () => {
      alive = false;
      ws = null;
      fire("disconnect");
      if (!closedByUs) scheduleReconnect();
    };
  }

  function scheduleReconnect(): void {
    if (closedByUs) return;
    attempts += 1;
    const delay = Math.min(30_000, reconnectBaseMs * Math.pow(2, attempts - 1));
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      void attempt();
    }, delay);
  }

  return {
    async connect(): Promise<void> {
      closedByUs = false;
      await attempt();
    },
    disconnect(): void {
      closedByUs = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        ws = null;
      }
      alive = false;
    },
    on(event, handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return () => handlers.get(event)?.delete(handler);
    },
    emit(event, data) {
      // Test seam — a real server frame calls `fire()` via `ws.onmessage`.
      fire(event, data);
    },
    get connected() {
      return alive;
    },
  };
}

/** BFF-issued short-lived socket ticket. Server-only cookie → client token. */
export async function fetchSocketTicket(): Promise<string> {
  const res = await fetch("/api/notifications/ws-ticket", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ws-ticket ${res.status}`);
  const body = (await res.json()) as { data?: { ticket?: string } };
  const ticket = body.data?.ticket;
  if (!ticket) throw new Error("ws-ticket missing");
  return ticket;
}
