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
  await fenetre.getByLabel("Trajet (km, aller simple)", { exact: true }).fill("30")
  await fenetre.getByLabel("Jours travaillés par an", { exact: true }).fill("218")
  await fenetre.getByRole("button", { name: "Enregistrer" }).click()
  await expect(fenetre).toBeHidden()

  const ligne = (libelle: string) => resultats.locator("div").filter({ has: page.getByText(libelle, { exact: true }) }).last()
  await expect(ligne("Frais réels retenus")).toContainText(/− 6\s065\s€plutôt que .* de déduction de 10 %/)
  await expect(ligne("dont trajets domicile-travail")).toContainText(/6\s065\s€13\s080 km au barème/)

  // Les déplacements professionnels de la SASU : 5 000 km en 5 CV, soit 3 180 € d'indemnités kilométriques.
  const societe = await reglagesDe(page, "Conseil SASU")
  await societe.getByRole("switch", { name: "Déplacements avec une voiture personnelle" }).click()
  await societe.getByLabel("Kilomètres professionnels par an", { exact: true }).fill("5000")
  await societe.getByRole("button", { name: "Enregistrer" }).click()
  await expect(societe).toBeHidden()
  await expect(ligne("dont déplacements professionnels")).toContainText(/3\s180\s€5\s000 km au barème kilométrique, déductibles/)
})

test("saisir deux trajets de Julien avec la même voiture : le barème s'applique une fois à leur total", async ({ page }) => {
  await ouvrir(page)
  const resultats = page.locator("section").filter({ has: page.getByRole("heading", { name: "Résultats de simulation" }) })

  // Trajet 1 : 30 km, 120 jours, soit 7 200 km. Trajet 2 : 50 km non justifiés, limités à 40 km, 98 jours, soit
  // 7 840 km. Même voiture de 5 CV : 15 040 x 0,357 + 1 395 = 6 764,28 €.
  const fenetre = await reglagesDe(page, "Julien Martin")
  await fenetre.getByRole("switch", { name: "Comparer mes frais réels à la déduction de 10 %" }).click()
  const premier = fenetre.getByRole("group", { name: "Trajet 1" })
  await premier.getByLabel("Trajet (km, aller simple)", { exact: true }).fill("30")
  await premier.getByLabel("Jours travaillés par an", { exact: true }).fill("120")

  await fenetre.getByRole("button", { name: "Ajouter un trajet" }).click()
  // Le focus est sur le nom du nouveau trajet : la saisie continue au clavier.
  await page.keyboard.type("Client à Lyon")
  const second = fenetre.getByRole("group", { name: "Trajet 2 : Client à Lyon" })
  await second.getByLabel("Trajet (km, aller simple)", { exact: true }).fill("50")
  await second.getByLabel("Jours travaillés par an", { exact: true }).fill("98")
  await fenetre.getByRole("button", { name: "Enregistrer" }).click()
  await expect(fenetre).toBeHidden()

  const ligne = (libelle: string) => resultats.locator("div").filter({ has: page.getByText(libelle, { exact: true }) }).last()
  await expect(ligne("Frais réels retenus")).toContainText(/− 6\s764\s€plutôt que .* de déduction de 10 %/)
  await expect(ligne("dont trajets domicile-travail")).toContainText(/6\s764\s€15\s040 km au barème/)

  // Les trajets sont gardés à la réouverture, et le second se retire.
  const reouverte = await reglagesDe(page, "Julien Martin")
  await expect(reouverte.getByRole("group", { name: "Trajet 2 : Client à Lyon" }).getByLabel("Trajet (km, aller simple)", { exact: true })).toHaveValue("50")
  await reouverte.getByRole("button", { name: "Retirer le trajet 2" }).click()
  await expect(reouverte.getByRole("button", { name: "Ajouter un trajet" })).toBeFocused()
  await reouverte.getByRole("button", { name: "Enregistrer" }).click()
  // 7 200 x 0,357 + 1 395 = 3 965,40 €.
  await expect(ligne("dont trajets domicile-travail")).toContainText(/3\s965\s€7\s200 km au barème/)
})
