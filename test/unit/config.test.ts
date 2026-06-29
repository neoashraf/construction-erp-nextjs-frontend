import { serverEnvSchema, publicEnvSchema, parseEnvOrThrow } from "@/lib/config/schema";

describe("config — fail-fast env validation", () => {
  const validServer = {
    NESTJS_API_BASE_URL: "http://localhost:4000/api",
    AUTH_CSRF_SECRET: "a-sufficiently-long-secret-value",
    AUTH_COOKIE_SECURE: "false",
    AUTH_COOKIE_SAMESITE: "lax",
    USE_MOCK_NESTJS: "false",
  };

  it("accepts a valid server env and coerces booleans", () => {
    const cfg = parseEnvOrThrow(serverEnvSchema, validServer, "server");
    expect(cfg.NESTJS_API_BASE_URL).toBe("http://localhost:4000/api");
    expect(cfg.AUTH_COOKIE_SECURE).toBe(false);
    expect(cfg.USE_MOCK_NESTJS).toBe(false);
  });

  it("throws a readable error when the NestJS base URL is missing/invalid", () => {
    expect(() =>
      parseEnvOrThrow(serverEnvSchema, { ...validServer, NESTJS_API_BASE_URL: "not-a-url" }, "server"),
    ).toThrow(/NESTJS_API_BASE_URL/);
  });

  it("throws when the CSRF secret is too short", () => {
    expect(() =>
      parseEnvOrThrow(serverEnvSchema, { ...validServer, AUTH_CSRF_SECRET: "short" }, "server"),
    ).toThrow(/AUTH_CSRF_SECRET/);
  });

  it("validates the public env (NEXT_PUBLIC_APP_URL)", () => {
    expect(parseEnvOrThrow(publicEnvSchema, { NEXT_PUBLIC_APP_URL: "http://localhost:3000" }, "public")
      .NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(() => parseEnvOrThrow(publicEnvSchema, { NEXT_PUBLIC_APP_URL: "" }, "public")).toThrow();
  });
});
