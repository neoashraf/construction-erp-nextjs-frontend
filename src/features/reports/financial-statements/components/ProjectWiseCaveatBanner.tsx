import { Alert } from "@/components/ui/alert";

/**
 * FE-55 caveat banner for the project-wise balance sheet (spec §5/§8/§9;
 * SRS §16). Shown whenever a `projectId` filter is active on the BS tab —
 * many asset/liability lines are company-wide and won't appear in a project-
 * scoped balance sheet. The `id` is used by the parent to wire
 * `aria-describedby` on the project control.
 */
export function ProjectWiseCaveatBanner({ id }: { id: string }) {
  return (
    <Alert
      id={id}
      tone="warning"
      title="This is a partial balance sheet."
      className="mb-4"
      data-testid="bs-caveat"
    >
      <span className="text-[12.5px]">
        Only balance-sheet lines tagged to a project are included — many asset/liability lines
        are company-wide and won&rsquo;t appear here.
      </span>
    </Alert>
  );
}
