import { z } from "zod";

/**
 * Entry-viewer id param schema (FE-12; skill §6). The Entry viewer is a pure GET by
 * id — there is no form here (spec §7, "no inputs") — but the route's dynamic segment
 * is still parsed/validated so a malformed id (empty, whitespace) fails fast client-side
 * with the same 404 view rather than firing a doomed request.
 */
export const entryIdSchema = z.string().trim().min(1, "An entry id is required.");

export type EntryId = z.infer<typeof entryIdSchema>;

/** Parse a route param into a valid entry id, or `null` if malformed. */
export function parseEntryId(raw: string | undefined): EntryId | null {
  const result = entryIdSchema.safeParse(raw ?? "");
  return result.success ? result.data : null;
}
