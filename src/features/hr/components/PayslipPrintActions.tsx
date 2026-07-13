"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { PAYSLIP_COPY } from "../schemas/payslip.schema";

/**
 * Print action(s). "Print" (single doc) / "Print all" (list) — both use the browser's
 * native print flow with the print stylesheet on the document root (`@media print` +
 * `.print-hide` marker on chrome). If `window.print()` throws we surface the exact spec §8
 * failure toast; this screen has no server-side PDF (spec §14).
 */
export function PayslipPrintActions({
  variant = "single",
}: {
  variant?: "single" | "all";
}) {
  const { toast } = useToast();
  const label = variant === "all" ? "Print all" : "Print";
  const testId = variant === "all" ? "payslip-print-all" : "payslip-print";
  return (
    <Button
      size="sm"
      variant="primary"
      data-testid={testId}
      className="print-hide"
      onClick={() => {
        try {
          if (typeof window !== "undefined" && typeof window.print === "function") {
            window.print();
          }
        } catch {
          toast(PAYSLIP_COPY.errorPrint, "error");
        }
      }}
    >
      {label}
    </Button>
  );
}
