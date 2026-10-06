// playwright.captures.config.ts
// Captures d'écran du README et de la fiche du Microsoft Store, sur une simulation fictive : « npm run captures »
// (application compilée au préalable).

import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "captures",
  testMatch: "**/*.captures.ts",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  outputDir: "test-results"
})
