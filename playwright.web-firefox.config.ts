// playwright.web-firefox.config.ts
// Les tests de la démo web, dans Firefox : « npm run test:web:firefox ». La série est celle de Chromium
// (playwright.web.config.ts), avec le moteur et l'identité de Firefox. Ce qui tient à Chromium (PDF, installation de la
// démo en application) se saute dans le test même, avec sa raison (e2e-web/support/navigateur.ts).
//
// La CI ne lance dans Firefox que les fichiers de mise en page (« npm run test:web:firefox:mise-en-page ») : c'est là
// que les deux moteurs diffèrent, et la série entière y prend deux fois plus de temps que dans Chromium.

import { defineConfig, devices } from "@playwright/test"
import web from "./playwright.web.config"

/** Ce qui dépend du moteur de rendu : zoom, lisibilité, tableaux qui défilent, bulles, barres collées, téléphone. */
const MISE_EN_PAGE = [
  "zoom-balayage",
  "zoom-lisibilite",
  "zoom-hauteur",
  "lisibilite",
  "defilement-des-tableaux",
  "comparateur-notes",
  "comparateur-alignement",
  "comparateur-largeurs",
  "focus-sous-les-barres",
  "bande-des-mois",
  "barre-etroite",
  "telephone-compact",
  "lignes-de-flux",
  // La console de Firefox, plus bavarde que celle de Chromium, ne doit rien relever à l'ouverture de la démo.
  "demo"
]

export default defineConfig({
  ...web,
  testMatch: process.env.FIREFOX_MISE_EN_PAGE ? MISE_EN_PAGE.map(fichier => `**/${fichier}.web.ts`) : web.testMatch,
  outputDir: "test-results/web-firefox",
  // Après les réglages de Chromium : l'appareil apporte son moteur, son identité et sa taille d'écran ; la fenêtre des
  // tests reste celle de la série.
  use: {
    ...web.use,
    ...devices["Desktop Firefox"],
    viewport: web.use?.viewport,
    // Lire le presse-papiers depuis un test : Firefox n'a pas de permission à accorder comme Chromium.
    launchOptions: { firefoxUserPrefs: { "dom.events.asyncClipboard.readText": true, "dom.events.testing.asyncClipboard": true } }
  }
})
