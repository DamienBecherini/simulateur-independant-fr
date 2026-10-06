// e2e-web/repartition.web.ts
// Partage du bénéfice des sociétés dans le comparateur : la poignée de rémunération se fait glisser à la souris
// et règle la colonne SASU ; le contrôle ne présente aucune violation WCAG, en clair, en sombre et sur téléphone.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"
import { deplierLeTableauDuComparateur } from "./support/affichage"
import { choisirLaPolice, POLICES } from "./support/police"

/** Ouvre la démo, déplie le tableau du comparateur et le passe en répartition personnalisée, poignées comprises. */
async function ouvrirEnRepartitionPersonnalisee(page: Page) {
  await page.goto("./")
  await deplierLeTableauDuComparateur(page)
  await page.getByRole("group", { name: "Bénéfice de la société (SASU, EURL)" }).getByText("Sur mesure").click()
  await expect(page.getByRole("radio", { name: "Sur mesure" })).toBeChecked()
  await expect(page.getByRole("slider", { name: "Rémunération nette du dirigeant" })).toBeVisible()
}

/** Le net dans la poche de la colonne SASU. */
const netSasu = (page: Page) => page.getByRole("table", { name: "Comparaison des statuts" }).getByRole("row", { name: /^Net dans la poche/ }).getByRole("cell").first()

test("faire glisser la poignée de rémunération règle la colonne SASU du comparateur", async ({ page }) => {
  await ouvrirEnRepartitionPersonnalisee(page)
  const poignee = page.getByRole("slider", { name: "Rémunération nette du dirigeant" })
  await expect(poignee).toHaveAttribute("aria-valuenow", "0")
  const avant = await netSasu(page).textContent()

  // La barre doit être à l'écran : sinon la souris presse hors de la fenêtre (polices plus hautes sous Linux).
  await poignee.scrollIntoViewIfNeeded()
  const boite = (await poignee.boundingBox())!
  const barre = (await page.locator("section[aria-labelledby=repartition-titre] .touch-none").first().boundingBox())!
  await page.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2)
  await page.mouse.down()
  await page.mouse.move(barre.x + barre.width * 0.3, boite.y + boite.height / 2, { steps: 10 })
  // Pendant le glissement, la poignée suit le pointeur, par pas de 100 €.
  await expect.poll(async () => Number(await poignee.getAttribute("aria-valuenow"))).toBeGreaterThan(0)
  const pendant = Number(await poignee.getAttribute("aria-valuenow"))
  expect(pendant % 100).toBe(0)
  await page.mouse.up()

  await expect(netSasu(page)).not.toHaveText(avant!)
  await expect(page.getByRole("table", { name: "Partage du bénéfice en SASU" }).getByRole("row", { name: /Rémunération nette/ })).toContainText(`${pendant.toLocaleString("fr-FR")} €`.replace(/\s/g, " "))
  await expect(page.getByLabel("Rémunération nette annuelle (SASU, EURL)")).toHaveValue(String(pendant))
})

test("la part distribuée se règle au clavier et laisse le reste dans la société", async ({ page }) => {
  await ouvrirEnRepartitionPersonnalisee(page)
  const part = page.getByRole("slider", { name: "Part du bénéfice distribuable versée en dividendes" })
  await part.focus()
  await page.keyboard.press("PageDown")
  await page.keyboard.press("PageDown")
  await expect(part).toHaveAttribute("aria-valuenow", "50")
  const conserve = page.getByRole("table", { name: "Comparaison des statuts" }).getByRole("row", { name: /^Conservé dans/ }).getByRole("cell").first()
  await expect(conserve).not.toHaveText("0 €")
})

test("le partage du bénéfice ne présente aucune violation WCAG, en clair et en sombre", async ({ page }) => {
  await ouvrirEnRepartitionPersonnalisee(page)
  await page.getByRole("slider", { name: "Rémunération nette du dirigeant" }).focus()
  await auditer(page, "partage du bénéfice, thème clair", "section[aria-labelledby=repartition-titre]")
  await auditer(page, "choix de la répartition, thème clair", "fieldset")
  await page.getByRole("switch", { name: "Changer de thème" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await auditer(page, "partage du bénéfice, thème sombre", "section[aria-labelledby=repartition-titre]")
  await auditer(page, "choix de la répartition, thème sombre", "fieldset")
})

test.describe("sur un téléphone", () => {
  test.use({ viewport: { width: 375, height: 800 } })

  for (const police of POLICES) {
    test(`le partage du bénéfice tient dans la largeur et ne présente aucune violation WCAG, ${police}`, async ({ page, context }) => {
      await choisirLaPolice(context, police)
      await ouvrirEnRepartitionPersonnalisee(page)
      const section = page.locator("section[aria-labelledby=repartition-titre]")
      const largeur = await section.evaluate(element => ({ contenu: element.scrollWidth, visible: element.clientWidth }))
      expect(largeur.contenu).toBeLessThanOrEqual(largeur.visible)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
      await auditer(page, "partage du bénéfice, 375 px", "section[aria-labelledby=repartition-titre]")
    })
  }
})
