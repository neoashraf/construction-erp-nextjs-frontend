import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PAYSLIP_COPY } from "../schemas/payslip.schema";

/**
 * Not-posted guard view (spec §13; mirrors API `SALARY_NOT_POSTED`). Shown when a user
 * arrives at the payslip sub-route for a DRAFT parent run — payslips only exist once the
 * sheet is posted. Copy is verbatim per spec §8.
 */
export function NotPostedGuard({ sheetId }: { sheetId: string }) {
  return (
    <Card
      className="mx-auto max-w-lg p-8 text-center"
      data-testid="payslip-not-posted-guard"
    >
      <p className="text-[14px] font-semibold text-foreground">{PAYSLIP_COPY.notPosted}</p>
      <div className="mt-4">
        <Button
          asChild
          variant="outline"
          size="sm"
          data-testid="payslip-back-to-sheet"
        >
          <Link href={`/hr/salary-sheets/${sheetId}`}>{PAYSLIP_COPY.backToSheet}</Link>
        </Button>
      </div>
    </Card>
  );
}
