import { formatDateTime } from "@/lib/format";

/**
 * FE-54 caption — "Generated at {DD/MM/YYYY HH:mm}" for the result table (spec §10;
 * associated to the table via `aria-describedby={this element's id}`).
 */
export function ReportGeneratedAt({
  generatedAt,
  id,
}: {
  generatedAt: string;
  id?: string;
}) {
  const formatted = safeFormat(generatedAt);
  return (
    <p
      id={id}
      className="mt-1 text-[11.5px] text-muted-foreground"
      data-testid="report-generated-at"
    >
      Generated at {formatted}
    </p>
  );
}

function safeFormat(iso: string): string {
  try {
    return formatDateTime(iso);
  } catch {
    return iso;
  }
}
