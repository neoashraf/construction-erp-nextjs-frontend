/**
 * Static sort-caret grid header cell (design "Contra/Journal Voucher.dc.html" line
 * table). Debit/Credit are entry columns with no server sort — this only renders the
 * design's visual caret affordance, shared by the contra + journal line tables.
 */
export function SortHeadCell({ label }: { label: string }) {
  return (
    <span className="flex items-center justify-end gap-1 text-right">
      {label}
      <span className="flex flex-col text-[8px] leading-[0.6]" aria-hidden>
        <span className="text-border-strong">▲</span>
        <span className="text-border-strong">▼</span>
      </span>
    </span>
  );
}
