// e2e-web/demo.web.ts
// La démo web dans un vrai navigateur : simulation d'exemple, calculs dans la page, stockage local.

import { test, expect, type Page } from "@playwright/test"

const NOM_EXEMPLE = "Famille Martin, simulation 2026"

/** Ouvre la démo et attend la première simulation, en relevant les erreurs de la console. */
async function ouvrir(page: Page): Promise<string[]> {
  const erreurs: string[] = []
  page.on("console", message => {
    if (message.type() === "error") erreurs.push(message.text())
  })
  page.on("pageerror", erreur => erreurs.push(erreur.message))
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  return erreurs
}

test("à la première visite, la démo s'ouvre sur la simulation d'exemple, calculée dans la page", async ({ page }) => {
  const erreurs = await ouvrir(page)

  await expect(page).toHaveTitle("Simulateur de revenus pour indépendants")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(NOM_EXEMPLE)
  await expect(page.getByRole("complementary", { name: "Démo web" })).toBeVisible()
  await expect(page.getByText("Net dans la poche", { exact: true }).first()).toBeVisible()
  await expect(page.getByRole("table", { name: "Comparaison des statuts" })).toBeVisible()

  expect(erreurs).toEqual([])
})

test("les modifications sont conservées dans le navigateur, jusqu'à ce qu'on reparte de l'exemple", async ({ page }) => {
  await ouvrir(page)
  const noms = page.getByRole("textbox", { name: "Nom" })
  const avant = await noms.count()

  await page.getByRole("button", { name: "+ Ajouter une Personne" }).click()
  await noms.last().fill("Bernard Petit")
  await noms.last().press("Enter")
  await expect(noms).toHaveCount(avant + 1)

  await page.reload()
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await expect(noms).toHaveCount(avant + 1)
  await expect(noms.last()).toHaveValue("Bernard Petit")

  await page.getByRole("button", { name: "Recommencer avec l'exemple" }).click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(NOM_EXEMPLE)
  await expect(noms).toHaveCount(avant)
})
