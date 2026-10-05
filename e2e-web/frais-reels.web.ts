// e2e-web/frais-reels.web.ts
// Frais réels et déplacements professionnels dans la démo web : saisie dans la fenêtre de réglages, puis lecture des résultats.

import { test, expect, type Page } from "@playwright/test"

async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByText(/année 2026 avec les règles fiscales 2026/)).toBeVisible()
}

/** Ouvre la fenêtre de réglages de l'acteur dont la carte porte ce nom. */
async function reglagesDe(page: Page, nom: string) {
  const boutons = page.getByRole("button", { name: "Modifier les autres réglages" })
  const nombre = await boutons.count()
  for (let i = 0; i < nombre; i++) {
    await boutons.nth(i).click()
    const fenetre = page.getByRole("dialog", { name: `Modifier : ${nom}` })
    if (await fenetre.isVisible()) return fenetre
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden()
  }
  throw new Error(`Aucune fenêtre de réglages pour ${nom}`)
}

test("saisir les trajets de Julien : ses frais réels l'emportent sur la déduction de 10 %", async ({ page }) => {
  await ouvrir(page)
  const resultats = page.locator("section").filter({ has: page.getByRole("heading", { name: "Résultats de simulation" }) })
  await expect(resultats.getByText("Frais réels retenus")).toHaveCount(0)

  // Julien, président de la SASU, se fait verser 30 000 € nets : 30 km par trajet, 218 jours, 5 CV, soit 13 080 km
  // et 13 080 x 0,357 + 1 395 = 6 064,56 €, plus que 10 % de sa rémunération imposable.
  const fenetre = await reglagesDe(page, "Julien Martin")
  await fenetre.getByRole("switch", { name: "Comparer mes frais réels à la déduction de 10 %" }).click()
  await fenetre.getByLabel("Trajet (km, aller simple)").fill("30")
  await fenetre.getByLabel("Jours travaillés par an").fill("218")
  await fenetre.getByRole("button", { name: "Enregistrer" }).click()
  await expect(fenetre).toBeHidden()

  const ligne = (libelle: string) => resultats.locator("div").filter({ has: page.getByText(libelle, { exact: true }) }).last()
  await expect(ligne("Frais réels retenus")).toContainText(/− 6\s065\s€plutôt que .* de déduction de 10 %/)
  await expect(ligne("dont trajets domicile-travail")).toContainText(/6\s065\s€13\s080 km au barème/)

  // Les déplacements professionnels de la SASU : 5 000 km en 5 CV, soit 3 180 € d'indemnités kilométriques.
  const societe = await reglagesDe(page, "Conseil SASU")
  await societe.getByRole("switch", { name: "Déplacements avec une voiture personnelle" }).click()
  await societe.getByLabel("Kilomètres professionnels par an").fill("5000")
  await societe.getByRole("button", { name: "Enregistrer" }).click()
  await expect(societe).toBeHidden()
  await expect(ligne("dont déplacements professionnels")).toContainText(/3\s180\s€5\s000 km au barème kilométrique, déductibles/)
})
