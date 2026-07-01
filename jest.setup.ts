import "@testing-library/jest-dom";

// Test-time env defaults so config validation (src/lib/config) passes in unit/component tests.
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.NESTJS_API_BASE_URL ??= "http://localhost:4000/api";
process.env.AUTH_CSRF_SECRET ??= "test-csrf-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
process.env.AUTH_COOKIE_SECURE ??= "false";
process.env.AUTH_COOKIE_SAMESITE ??= "lax";

// jsdom polyfills for Radix UI primitives (Dialog/Sheet/DropdownMenu) — jsdom lacks
// these APIs, which Radix touches for pointer capture, layout, and scroll locking.
if (typeof window !== "undefined") {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  if (!("ResizeObserver" in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  const proto = window.Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
}
