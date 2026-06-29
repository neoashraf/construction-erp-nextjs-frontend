import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { AsyncState } from "@/components/async-state";
import { makeQueryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/keys";
import { ApiError } from "@/lib/api/errors";

/**
 * Exercises the state matrix (loading → error+retry → success) driven by a real
 * TanStack Query hook over a MOCKED api layer, demonstrating query-key namespacing
 * and ApiError mapping (acceptance: "TanStack Query wired").
 */
function Probe({ api }: { api: () => Promise<{ items: string[] }> }) {
  const query = useQuery({
    queryKey: queryKeys.list("ledger", "entries", { companyId: "c1", financialYearId: "fy1" }),
    queryFn: api,
  });
  return (
    <AsyncState
      isLoading={query.isLoading}
      error={query.error}
      data={query.data}
      isEmpty={(d) => d.items.length === 0}
      onRetry={() => query.refetch()}
      loading={<span>loading-state</span>}
      empty={<span>empty-state</span>}
    >
      {(d) => <ul>{d.items.map((i) => <li key={i}>{i}</li>)}</ul>}
    </AsyncState>
  );
}

function renderProbe(api: () => Promise<{ items: string[] }>) {
  const client = makeQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <Probe api={api} />
    </QueryClientProvider>,
  );
}

describe("AsyncState + TanStack Query — state matrix", () => {
  it("renders loading then the loaded list", async () => {
    renderProbe(async () => ({ items: ["a", "b"] }));
    expect(screen.getByText("loading-state")).toBeInTheDocument();
    expect(await screen.findByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
  });

  it("renders the empty state for an empty result", async () => {
    renderProbe(async () => ({ items: [] }));
    expect(await screen.findByText("empty-state")).toBeInTheDocument();
  });

  it("renders the error state with retry (no auto-retry on 4xx), then recovers on retry", async () => {
    // A 4xx ApiError is NOT auto-retried (makeQueryClient.shouldRetry), so the
    // first rejection surfaces immediately; the manual retry then succeeds.
    const api = jest
      .fn<Promise<{ items: string[] }>, []>()
      .mockRejectedValueOnce(
        new ApiError({ code: "VALIDATION_ERROR", message: "boom", details: null, status: 400 }),
      )
      .mockResolvedValueOnce({ items: ["ok"] });

    renderProbe(api);
    const retry = await screen.findByRole("button", { name: /retry/i });
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
    expect(api).toHaveBeenCalledTimes(1); // proves no auto-retry on 4xx
    await userEvent.click(retry);
    await waitFor(() => expect(screen.getByText("ok")).toBeInTheDocument());
  });
});
