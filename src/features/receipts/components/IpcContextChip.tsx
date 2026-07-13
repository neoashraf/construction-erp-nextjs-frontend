"use client";

import { Filter, X } from "lucide-react";

/**
 * IPC deep-link context chip (FR-REC-016; spec §9; design file `Receipts.dc.html`
 * frame 1). Arriving with `?ipcId=` pre-applies the filter and shows this dismissible
 * chip "Filtered to IPC {label}"; dismissing clears the filter. `label` is the IPC's
 * own `entryNo` (e.g. "IPC/2526/0005"), resolved by the screen via `useIpcOptions`
 * (SAL's own `GET /api/sales/ipc` — REC never redefines the IPC, contract 11 "Not
 * endpoints"; this only reads SAL's resource for display, same as the Party/Project
 * picker options). Falls back to the raw id while the option set is still loading or
 * the IPC falls outside the fetched window — the same "(name unavailable)"-style
 * partial-state fallback used elsewhere on this screen.
 */
export function IpcContextChip({ label, onDismiss }: { label: string; onDismiss: () => void }) {
  return (
    <div
      className="mb-3 inline-flex items-center gap-2 rounded-pill bg-info-soft px-3 py-1.5 text-[12.5px] font-semibold text-info-ink"
      data-testid="receipt-ipc-context-chip"
    >
      <Filter className="h-3.5 w-3.5" aria-hidden />
      <span>
        Filtered to IPC <span className="font-mono">{label}</span>
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Clear IPC filter"
        data-testid="receipt-ipc-context-dismiss"
        className="rounded-full p-0.5 hover:bg-info/20"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
