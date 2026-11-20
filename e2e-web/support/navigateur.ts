// e2e-web/support/navigateur.ts
// Ce qui diffère d'un navigateur à l'autre dans les tests de la démo web, lancés dans Chromium (npm run test:web) et
// dans Firefox (npm run test:web:firefox).

import type { BrowserContext } from "@playwright/test"

/** Pourquoi un test est sauté hors de Chromium, quand il vérifie ce que seul Chromium sait faire sous Playwright. */
export const SEUL_CHROMIUM = {
  pdf: "Seul Chromium sait produire un PDF sous Playwright : la mise en page imprimée est vérifiée dans Chromium.",
  installabilite: "L'installabilité se lit par le protocole de débogage de Chromium ; Firefox n'installe pas de site.",
  aideDInstallation: "L'aide d'Edge et de Chrome s'affiche dans Chromium ; celle de Firefox a son propre test."
}

/**
 * Laisse le test lire le presse-papiers. Chromium demande une permission ; Firefox n'en a pas à accorder, sa
 * configuration de test ouvre la lecture (firefoxUserPrefs de playwright.web-firefox.config.ts).
 */
export async function autoriserLePressePapiers(context: BrowserContext, browserName: string): Promise<void> {
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"])
}
