"use client";

import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { usePayslip, PAYROLL_PERIOD } from "../hooks/usePayroll";
import { PayslipDocument } from "./PayslipDocument";

const isBn = (s: string) => /[ঀ-৿]/.test(s);
const SALARY_PATH = "/hr/salary-sheets";
const PAYSLIPS_PATH = "/hr/payslips";

/**
 * Single payslip document (FR-HR-017; Payslip.dc.html). Opens one employee's payslip
 * from the posted June-2025 run with Back / Download PDF / Print actions. Read-only;
 * the figures are the immutable salary lines captured at posting.
 */
export function PayslipScreen({ code }: { code: string }) {
  const payslip = usePayslip(code);

  if (!payslip) {
    return (
      <div className="mx-auto max-w-4xl">
        <Breadcrumb
          items={[
            { label: "Salary sheets", href: SALARY_PATH },
            { label: "Payslips", href: PAYSLIPS_PATH },
            { label: code },
          ]}
        />
        <div className="mt-4">
          <EmptyState
            title="Payslip not found."
            description="This payslip isn't part of the posted June 2025 run."
            action={
              <Button asChild variant="outline">
                <Link href={PAYSLIPS_PATH}>Back to payslips</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumb
        items={[
          { label: "Salary sheets", href: SALARY_PATH },
          { label: PAYROLL_PERIOD.label, href: `${SALARY_PATH}/sh-2025-06` },
          { label: "Payslips", href: PAYSLIPS_PATH },
          { label: payslip.name },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={cn("text-[23px] font-bold tracking-[-0.01em]", isBn(payslip.name) && "font-sans")}>
          Payslip — {payslip.name}, {payslip.periodLabel}
        </h1>
        <div className="flex flex-none gap-2.5">
          <Button variant="outline" size="md" asChild>
            <Link href={PAYSLIPS_PATH}>Back to salary sheet</Link>
          </Button>
          <Button variant="outline" size="md" onClick={() => window.print()}>
            <Download className="h-4 w-4" aria-hidden />
            Download PDF
          </Button>
          <Button size="md" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden />
            Print
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <PayslipDocument payslip={payslip} />
      </div>
    </div>
  );
}
