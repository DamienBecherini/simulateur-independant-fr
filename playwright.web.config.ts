// playwright.web.config.ts
// Tests de la démo web : Playwright sert la version compilée pour le navigateur (vite preview) et la pilote
// dans Chromium. Ils sont lancés par « npm run test:web », qui compile la démo au préalable.

import { defineConfig, devices } from "@playwright/test"

const PORT = 4173

export default defineConfig({
  testDir: "e2e-web",
  testMatch: "**/*.web.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  outputDir: "test-results/web",
  use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${PORT}/simulateur-independant-fr/`, viewport: { width: 1440, height: 900 } },
  webServer: { command: `npx vite preview --mode web --port ${PORT} --strictPort`, url: `http://localhost:${PORT}/simulateur-independant-fr/`, reuseExistingServer: !process.env.CI }
})
