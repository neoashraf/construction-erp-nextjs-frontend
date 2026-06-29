/**
 * Forbidden landing — shown when a route guard 403s a role out of a module it may
 * not access (skill §5). Defence-in-depth: this is the UI side; the backend also
 * returns FORBIDDEN for any request that slips through.
 */
export default function ForbiddenPage() {
  return (
    <section aria-labelledby="forbidden-h" role="alert" data-testid="forbidden">
      <h1 id="forbidden-h" className="text-xl font-semibold">
        Access denied
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your role does not have access to this area. If you believe this is an error, contact your
        administrator.
      </p>
    </section>
  );
}
