// playwright.web.config.ts
// Tests de la démo web : Playwright sert la version compilée pour le navigateur (vite preview) et la pilote
// dans Chromium. Ils sont lancés par « npm run test:web », qui compile la démo au préalable.
// Le service worker de la démo (hors ligne) est bloqué, sauf dans installable.web.ts qui le teste (test.use) : ailleurs,
// il servirait les fichiers depuis son cache, hors de portée de page.route, et chaque test en remplirait un.
// Les tests ouvrent la démo en affichage « Résumé », comme choisi lors d'une visite précédente : écrits avant que
// « Trois vues » devienne l'affichage par défaut, ils attendent la page entière. Ceux qui vérifient l'affichage d'un
// nouveau visiteur repartent d'un stockage vide (test.use({ storageState: NOUVEAU_VISITEUR }), dans e2e-web/support/affichage.ts).

import { defineConfig, devices } from "@playwright/test"

const PORT = Number(process.env.PORT_E2E_WEB ?? 4173)

/** La préférence d'affichage « Résumé », déjà enregistrée dans le stockage du navigateur de la démo. */
const AFFICHAGE_RESUME = { cookies: [], origins: [{ origin: `http://localhost:${PORT}`, localStorage: [{ name: "simulateur.preferences", value: JSON.stringify({ slotOrder: [], affichage: "resume" }) }] }] }

export default defineConfig({
  testDir: "e2e-web",
  testMatch: "**/*.web.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  outputDir: "test-results/web",
  use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${PORT}/simulateur-independant-fr/`, viewport: { width: 1440, height: 900 }, serviceWorkers: "block", storageState: AFFICHAGE_RESUME },
  webServer: { command: `npx vite preview --mode web --port ${PORT} --strictPort`, url: `http://localhost:${PORT}/simulateur-independant-fr/`, reuseExistingServer: !process.env.CI }
})
