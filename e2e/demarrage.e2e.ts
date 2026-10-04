// e2e/demarrage.e2e.ts

import { test, expect } from "./support/fixtures"

test("au démarrage, la fenêtre principale s'ouvre avec le preload chargé et sans erreur", async ({ lancer }) => {
  const { electronApp, page, erreursConsole } = await lancer()

  await expect(page).toHaveTitle(/.+/)
  await expect(page.getByRole("heading", { name: "Acteurs de la Simulation" })).toBeVisible()
  await expect(page.getByText("Aucune entité. Commencez par en ajouter une !")).toBeVisible()

  // Le preload expose l'API du process principal à l'interface.
  const fonctionsExposees = await page.evaluate(() => Object.keys(window.api ?? {}))
  expect(fonctionsExposees).toEqual(expect.arrayContaining(["getCurrentSession", "saveCurrentSession", "runMetaSimulation", "compareStatuts"]))

  // La fenêtre d'accueil est refermée une fois la fenêtre principale affichée.
  await expect.poll(() => electronApp.windows().length).toBe(1)
  expect(await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(w => w.isVisible()).length)).toBe(1)

  expect(erreursConsole).toEqual([])
})

// Anomalie connue, non corrigée : sans fichier de session (tout premier lancement), le chargement échoue comme
// pour un fichier corrompu, et une boîte « Chargement échoué » s'affiche. Ce test est marqué comme devant échouer :
// il signalera la correction en se mettant à passer.
test("au tout premier lancement, aucune boîte de dialogue d'erreur ne s'affiche", async ({ lancer }) => {
  test.fail(true, "Le premier lancement affiche « Chargement échoué » (fichier de session absent traité comme corrompu)")
  const { dialogues } = await lancer()
  expect(await dialogues()).toEqual([])
})
