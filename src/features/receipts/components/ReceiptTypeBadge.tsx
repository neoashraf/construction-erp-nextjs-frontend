import { Badge } from "@/components/ui/badge";
import { type ReceiptType } from "../types";

/**
 * Receipt type badge — "IPC-linked" (info/blue, a certified-payment-certificate
 * collection) vs "General" (neutral, non-project or advance collection). Design
 * file `Receipts.dc.html` frame 1; spec §5/§8. Shared with FE-43/FE-44.
 */
const TONE: Record<ReceiptType, "info" | "neutral"> = {
  IPC_LINKED: "info",
  GENERAL: "neutral",
};

const LABEL: Record<ReceiptType, string> = {
  IPC_LINKED: "IPC-linked",
  GENERAL: "General",
};

export function ReceiptTypeBadge({ type, className }: { type: ReceiptType; className?: string }) {
  return (
    <Badge tone={TONE[type]} dot className={className} data-testid={`receipt-type-${type}`}>
      {LABEL[type]}
    </Badge>
  );
}
