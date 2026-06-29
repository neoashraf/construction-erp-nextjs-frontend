import "@testing-library/jest-dom";

// Test-time env defaults so config validation (src/lib/config) passes in unit/component tests.
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.NESTJS_API_BASE_URL ??= "http://localhost:4000/api";
process.env.AUTH_CSRF_SECRET ??= "test-csrf-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
process.env.AUTH_COOKIE_SECURE ??= "false";
process.env.AUTH_COOKIE_SAMESITE ??= "lax";
