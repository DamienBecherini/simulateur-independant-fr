// playwright.config.ts
// Tests de bout en bout : Playwright pilote l'application Electron compilée (voir e2e/support/fixtures.ts).
// Ils sont lancés par « npm run test:e2e », qui compile l'application au préalable, et jamais par Vitest.

import { defineConfig } from "@playwright/test"

const enIntegrationContinue = !!process.env.CI

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  // Chaque test lance sa propre application sur son propre dossier de données : ils peuvent tourner en parallèle.
  fullyParallel: true,
  workers: enIntegrationContinue ? 1 : 3,
  forbidOnly: enIntegrationContinue,
  retries: enIntegrationContinue ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: enIntegrationContinue ? [["list"], ["html", { open: "never" }]] : [["list"]],
  outputDir: "test-results"
})
