import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Load next.config + .env files into the test environment.
  dir: "./",
});

const config: Config = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  /**
   * Jest's 5s default is a poor fit for this suite: the heaviest component tests
   * drive a whole multi-step voucher flow (`ipc-editor` saves a draft, opens a
   * confirm dialog, then posts) through RTL + `user-event`, and each of those
   * steps is several React commits. Under parallel workers those suites are
   * competing for CPU, so a run that passes comfortably `--runInBand` can trip
   * the default purely on scheduling latency — a flake that says nothing about
   * the code. 20s is still far below any real hang.
   */
  testTimeout: 20_000,
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
