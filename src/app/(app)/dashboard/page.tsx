/**
 * App home inside the shell. NO dashboard screen ships in the scaffold — this is a
 * placeholder landing so the shell has a default route. The real Dashboard (DSH)
 * is a later per-screen brief.
 */
export default function DashboardPlaceholder() {
  return (
    <section aria-labelledby="dash-h" data-testid="dashboard-placeholder">
      <h1 id="dash-h" className="text-xl font-semibold">
        Welcome
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The application shell is ready. Module screens are added by their per-screen briefs.
      </p>
    </section>
  );
}
