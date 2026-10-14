// e2e-web/combien-facturer.web.ts
// « Combien facturer pour un net visé ? », le calcul à l'envers du comparateur : sur la simulation d'exemple, l'atelier
// de Camille (micro-entreprise, au meilleur net) ; le chiffre d'affaires nécessaire dans chaque statut, la micro hors de
// portée au-delà de son plafond, des cartes sur téléphone, sans violation WCAG.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"

const SECTION = "section[aria-labelledby=combien-facturer-titre]"

/**
 * Ouvre la démo, déplie la section (repliée sur une ligne dans l'affichage « Résumé », par défaut) et demande le
 * chiffre d'affaires de l'atelier pour ce net du foyer.
 */
async function viser(page: Page, net: string) {
  await page.goto("./")
  const section = page.locator(SECTION)
  const champ = section.getByLabel("Net visé du foyer (€ par an)")
  await expect(champ).toBeHidden()
  await section.getByText("Combien facturer pour un net visé ?").click()
  await champ.fill(net)
  return section
}

/** Un texte affiché avec des montants (« 71 689 € »), quelles que soient les espaces : insécables ou non. */
const montant = (texte: string) => new RegExp(texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s/g, "\\s"))

test("donne, pour un net visé, le chiffre d'affaires annuel et mensuel de chaque statut", async ({ page }) => {
  const section = await viser(page, "90000")

  const tableau = section.getByRole("table", { name: /« Atelier de Camille » nécessaire pour 90\s000\s€ nets par an/ })
  await expect(tableau).toBeVisible()
  // Un en-tête et six colonnes du comparateur, portage salarial compris.
  await expect(tableau.getByRole("row")).toHaveCount(7)
  // Le chiffre d'affaires saisi de l'atelier, référence des écarts : 40 200 €.
  await expect(tableau.getByRole("columnheader", { name: montant("Écart avec le chiffre d'affaires saisi (40 200 €)") })).toBeVisible()
  const vfl = tableau.getByRole("row", { name: /^Micro \+ versement libératoire/ })
  await expect(vfl).toContainText("actuel")
  await expect(vfl.getByRole("cell").first()).toHaveText(montant("71 689 €"))
  await expect(vfl.getByRole("cell").nth(1)).toHaveText(montant("5 974 €"))
  await expect(vfl.getByRole("cell").nth(2)).toHaveText(montant("+31 489 €"))
  // La réponse en une phrase, annoncée aux lecteurs d'écran : le statut qui demande le moins.
  await expect(section.locator("[aria-live=polite]")).toHaveText(montant("Pour 90 000 € nets par an, il faut au moins 71 689 € de chiffre d'affaires par an (5 974 € par mois), en Micro + versement libératoire."))
})

test("dit la micro-entreprise hors de portée quand il faudrait dépasser son plafond", async ({ page }) => {
  const section = await viser(page, "150000")

  const tableau = section.getByRole("table")
  for (const statut of [/^Micro-entreprise/, /^Micro \+ versement libératoire/]) {
    await expect(tableau.getByRole("row", { name: statut }).getByRole("cell").first()).toHaveText("—hors de portée : plafond dépassé")
  }
  await expect(tableau.getByRole("row", { name: /^EI au réel/ }).getByRole("cell").first()).toHaveText(/^\d[\d\s]*\s€$/)
})

test("ne présente aucune violation WCAG, en clair et en sombre", async ({ page }) => {
  const section = await viser(page, "90000")
  await expect(section.getByRole("table")).toBeVisible()
  await auditer(page, "combien facturer, thème clair", SECTION)
  await page.getByRole("switch", { name: "Changer de thème" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await auditer(page, "combien facturer, thème sombre", SECTION)
})

test.describe("sur un téléphone", () => {
  test.use({ viewport: { width: 375, height: 800 } })

  test("une carte par statut remplace le tableau, sans défilement en largeur ni violation WCAG", async ({ page }) => {
    const section = await viser(page, "90000")
    const cartes = section.getByRole("list", { name: "Chiffre d'affaires nécessaire selon le statut" })
    await expect(cartes.getByRole("listitem")).toHaveCount(6)
    await expect(cartes.getByRole("listitem").filter({ hasText: "Micro + versement libératoire" })).toContainText(montant("soit 5 974 € par mois"))
    await expect(section.getByRole("table")).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await auditer(page, "combien facturer, 375 px", SECTION)
  })
})
