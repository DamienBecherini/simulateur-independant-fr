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

test("l'arbitrage rémunération / dividendes trouve la rémunération qui valide 4 trimestres, et la reporte dans le comparateur", async ({ page }) => {
  await ouvrir(page)
  const optimisation = page.getByRole("region", { name: "Rémunération ou dividendes ?" })

  // L'atelier de la simulation d'exemple, converti en SASU : le minimum pour 4 trimestres est de 5 800 € nets (7 212 € bruts au moins).
  const retraite = optimisation.getByRole("listitem").filter({ hasText: "Meilleur net avec 4 trimestres" })
  await expect(retraite).toContainText(/5\s800\s€ de rémunération nette/)

  // Au meilleur net, mode par défaut, 4 trimestres sont exigés d'office : le comparateur retient déjà cette rémunération.
  const caseRetraite = page.getByRole("checkbox", { name: "Avec 4 trimestres de retraite" })
  const enTeteSasu = page.getByRole("table", { name: "Comparaison des statuts" }).getByRole("columnheader", { name: /^SASU/ })
  await expect(caseRetraite).toBeChecked()
  await expect(enTeteSasu).toContainText(/rémunération optimale : 5\s800\s€ nets/)
  await expect(retraite.getByRole("button", { name: "Appliquée" })).toBeDisabled()

  // Le meilleur net sans condition décoche la case ; le meilleur net avec 4 trimestres la recoche.
  const meilleur = optimisation.getByRole("listitem").filter({ hasText: /^Meilleur net :/ })
  await meilleur.getByRole("button", { name: "Appliquer au comparateur" }).click()
  await expect(caseRetraite).not.toBeChecked()
  await expect(enTeteSasu).not.toContainText(/rémunération optimale : 5\s800\s€ nets/)
  await retraite.getByRole("button", { name: "Appliquer au comparateur" }).click()
  await expect(caseRetraite).toBeChecked()
  await expect(enTeteSasu).toContainText(/rémunération optimale : 5\s800\s€ nets/)
  await expect(retraite.getByRole("button", { name: "Appliquée" })).toBeDisabled()

  // Dans un autre mode, la rémunération est reportée telle quelle.
  await page.getByRole("radio", { name: "Rémunération saisie, le reste en dividendes" }).check({ force: true })
  await expect(page.getByLabel("Rémunération nette annuelle (SASU, EURL)")).toHaveValue("0")
  await retraite.getByRole("button", { name: "Appliquer au comparateur" }).click()
  await expect(page.getByLabel("Rémunération nette annuelle (SASU, EURL)")).toHaveValue("5800")
  await expect(retraite.getByRole("button", { name: "Appliquée" })).toBeDisabled()

  await optimisation.getByRole("button", { name: "EURL" }).click()
  await expect(optimisation.getByRole("group", { name: /Net du foyer selon la rémunération nette en EURL/ })).toBeVisible()
})
