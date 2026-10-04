// e2e-web/sauvegardes.web.ts
// Export de toutes les sauvegardes de la démo web dans un fichier téléchargé, puis import de ce fichier.

import { test, expect, type Page } from "@playwright/test"

/** Enregistre la simulation en cours sous un nom, depuis le panneau Paramètres. */
async function sauvegarderSous(page: Page, nom: string) {
  await page.getByRole("button", { name: "Paramètres" }).click()
  const parametres = page.getByRole("dialog", { name: "Configuration" })
  await parametres.getByLabel("Nom de la simulation").fill(nom)
  await parametres.getByRole("button", { name: "Sauvegarder" }).click()
  await expect(parametres).toBeHidden()
}

test("exporter toutes les sauvegardes, les supprimer, puis les retrouver en important le fichier téléchargé", async ({ page }, testInfo) => {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await sauvegarderSous(page, "Scénario A")
  await sauvegarderSous(page, "Scénario B")

  await page.getByRole("button", { name: "Paramètres" }).click()
  await page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: "Charger une sauvegarde..." }).click()
  const liste = page.getByRole("dialog", { name: "Charger une sauvegarde" })
  const sauvegardes = liste.getByRole("button", { name: /^Charger la sauvegarde/ })
  await expect(sauvegardes).toHaveCount(2)

  // Export : le navigateur télécharge un seul fichier, daté du jour.
  const telechargement = page.waitForEvent("download")
  await liste.getByRole("button", { name: "Exporter toutes les sauvegardes" }).click()
  const fichier = await telechargement
  expect(fichier.suggestedFilename()).toMatch(/^sauvegardes-simulateur-\d{4}-\d{2}-\d{2}\.json$/)
  const chemin = testInfo.outputPath("sauvegardes.json")
  await fichier.saveAs(chemin)

  // Suppression des deux sauvegardes.
  await liste.getByRole("button", { name: "Supprimer la sauvegarde « Scénario A »" }).click()
  await liste.getByRole("button", { name: "Supprimer la sauvegarde « Scénario B »" }).click()
  await expect(liste.getByText("Aucune sauvegarde trouvée.")).toBeVisible()

  // Import du fichier téléchargé, par le sélecteur de fichiers du navigateur.
  const selecteur = page.waitForEvent("filechooser")
  await liste.getByRole("button", { name: "Importer des sauvegardes..." }).click()
  await (await selecteur).setFiles(chemin)
  const bilan = page.getByRole("dialog", { name: "Import des sauvegardes" })
  await expect(bilan).toContainText("2 sauvegardes ajoutées à la fin de la liste.")
  await bilan.getByRole("button", { name: "OK" }).click()
  await expect(bilan).toBeHidden()

  await expect(sauvegardes).toHaveCount(2)
  await expect(liste.getByRole("button", { name: "Charger la sauvegarde « Scénario A »" })).toBeVisible()
  await expect(liste.getByRole("button", { name: "Charger la sauvegarde « Scénario B »" })).toBeVisible()

  // Les sauvegardes importées sont conservées dans le navigateur.
  await page.reload()
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await page.getByRole("button", { name: "Paramètres" }).click()
  await page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: "Charger une sauvegarde..." }).click()
  await expect(sauvegardes).toHaveCount(2)
})
