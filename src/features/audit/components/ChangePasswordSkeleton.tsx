import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the change-password card (design file — card frame in
 * place, field regions as pulse bars, no app chrome). Used as the page's
 * `<Suspense>` fallback while the server session resolves; the form itself has
 * no client data fetch (spec §6 marks in-form Loading N/A).
 */
export function ChangePasswordSkeleton() {
  const fieldLabelWidths = ["120px", "104px", "150px"];
  return (
    <div
      className="w-full max-w-[420px] rounded-card border border-border bg-background px-[30px] py-[30px] shadow-md"
      data-testid="change-password-skeleton"
      aria-busy="true"
      aria-label="Loading change password form"
    >
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-[30px] w-[30px] rounded-[8px]" />
        <Skeleton className="h-4 w-[170px] rounded-[5px]" />
      </div>
      {fieldLabelWidths.map((w, i) => (
        <div key={i} className="mt-[18px]">
          <Skeleton className="h-[9px] rounded-[4px]" style={{ width: w }} />
          <Skeleton className="mt-2 h-[42px] w-full" />
        </div>
      ))}
      <div className="mt-[14px] flex gap-2">
        <Skeleton className="h-[7px] w-3/5 rounded-pill" />
      </div>
      <Skeleton className="mt-[22px] h-11 w-full" />
    </div>
  );
}
