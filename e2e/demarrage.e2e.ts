// e2e/demarrage.e2e.ts

import { test, expect } from "./support/fixtures"

test("au démarrage, la fenêtre principale s'ouvre avec le preload chargé et sans erreur", async ({ lancer }) => {
  const { electronApp, page, erreursConsole } = await lancer()

  await expect(page).toHaveTitle(/.+/)
  await expect(page.getByRole("heading", { name: "Personnes et activités" })).toBeVisible()
  await expect(page.getByText("Aucune entité. Commencez par en ajouter une !")).toBeVisible()

  // Le preload expose l'API du process principal à l'interface.
  const fonctionsExposees = await page.evaluate(() => Object.keys(window.api ?? {}))
  expect(fonctionsExposees).toEqual(expect.arrayContaining(["getCurrentSession", "saveCurrentSession", "simulerLesAnnees", "compareStatuts", "optimiserRemuneration", "comparerStrategies", "saveTextFile", "openTextFile", "printToPdf"]))

  // La fenêtre d'accueil est refermée une fois la fenêtre principale prête.
  await expect.poll(() => electronApp.windows().length).toBe(1)

  expect(erreursConsole).toEqual([])
})

// Sans fichier de session (tout premier lancement), l'application démarre sur une simulation vierge, sans alerte.
test("au tout premier lancement, aucune boîte de dialogue d'erreur ne s'affiche", async ({ lancer }) => {
  const { dialogues } = await lancer()
  expect(await dialogues()).toEqual([])
})
