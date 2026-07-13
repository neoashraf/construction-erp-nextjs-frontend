import { apiClient } from "@/lib/api";
import { type MatchView } from "../types";

/**
 * PO → Bill → GRN match view (API contract 08 § "PO → Bill → GRN match & registers";
 * FR-PUR-017/-018). Read-only reconciliation of ordered vs billed vs received vs open
 * per PO line, with a per-line `matchStatus`. No mutation exists — this is a query.
 */
const BASE = "/purchase/orders";

export async function getMatch(poId: string): Promise<MatchView> {
  const res = await apiClient.get<{ data: MatchView }>(`${BASE}/${poId}/match`);
  return res.data;
}
