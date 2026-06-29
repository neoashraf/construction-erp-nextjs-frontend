import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Load next.config + .env files into the test environment.
  dir: "./",
});

const config: Config = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Unit + component tests only; Playwright e2e lives under test/e2e and runs via test:e2e.
  testMatch: ["<rootDir>/test/unit/**/*.test.{ts,tsx}", "<rootDir>/test/components/**/*.test.{ts,tsx}"],
  collectCoverageFrom: [
    "src/lib/money.ts",
    "src/lib/format.ts",
    "src/lib/api/**/*.ts",
    "src/lib/auth/**/*.ts",
    "src/lib/config/**/*.ts",
    "!src/lib/api/generated/**",
  ],
};

export default createJestConfig(config);
