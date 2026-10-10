// e2e-web/meilleur-net.web.ts
// Comparateur au meilleur net, mode proposé par défaut sans dividendes saisis : chaque colonne de société prend sa
// propre rémunération optimale, la case « avec 4 trimestres de retraite » la change, et le tout reste accessible,
// en clair, en sombre et sur téléphone.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"
import { deplierLeTableauDuComparateur } from "./support/affichage"
import { choisirLaPolice, POLICES } from "./support/police"

/**
 * Ouvre la démo : l'atelier de la simulation d'exemple, sans dividendes saisis, est comparé au meilleur net ; le
 * tableau est déplié en entier (affichage « Résumé », par défaut).
 */
async function ouvrir(page: Page) {
  await page.goto("./")
  await deplierLeTableauDuComparateur(page)
}

const tableau = (page: Page) => page.getByRole("table", { name: "Comparaison des statuts" })
const enTete = (page: Page, statut: string) => tableau(page).getByRole("columnheader", { name: new RegExp(`^${statut}`) })
/** La rémunération optimale affichée dans l'en-tête d'une colonne, en euros. */
async function remunerationDe(page: Page, statut: string): Promise<number> {
  const texte = (await enTete(page, statut).textContent()) ?? ""
  const trouvee = /rémunération optimale : ([\d\s]+)\s€ nets/.exec(texte)
  expect(trouvee, `rémunération optimale absente de l'en-tête ${statut} : ${texte}`).not.toBeNull()
  return Number(trouvee![1].replace(/\D/g, ""))
}

test("par défaut, chaque colonne de société affiche sa propre rémunération optimale", async ({ page }) => {
  await ouvrir(page)

  await expect(page.getByRole("radio", { name: "Meilleur net" })).toBeChecked()
  await expect(page.getByLabel("Rémunération nette annuelle (SASU, EURL)")).toHaveCount(0)
  await expect(enTete(page, "SASU")).toContainText("rémunération optimale")
  await expect(enTete(page, "EURL")).toContainText("rémunération optimale")
  await expect(enTete(page, "EI au réel")).not.toContainText("rémunération optimale")

  // L'atelier converti en SASU : tout en dividendes ; en EURL, une rémunération réduit les cotisations sur dividendes.
  const sasu = await remunerationDe(page, "SASU")
  const eurl = await remunerationDe(page, "EURL")
  expect(sasu).not.toBe(eurl)

  // La barre de partage du bénéfice montre, en lecture seule, la rémunération de la colonne SASU.
  const partage = page.locator("section[aria-labelledby=repartition-titre]")
  await expect(partage).toContainText("Au meilleur net : la rémunération optimale en SASU")
  await expect(partage.getByRole("slider")).toHaveCount(0)
})

test("avec 4 trimestres de retraite, la SASU verse la plus petite rémunération qui les valide", async ({ page }) => {
  await ouvrir(page)

  await page.getByRole("checkbox", { name: "Avec 4 trimestres de retraite" }).check()

  await expect(enTete(page, "SASU")).toContainText(/rémunération optimale : 5\s800\s€ nets/)
  await expect(enTete(page, "SASU")).toContainText("avec 4 trimestres de retraite")
  const protection = tableau(page).getByRole("row", { name: /^Protection sociale/ }).getByRole("cell").first()
  await expect(protection).toContainText("4 trim. retraite")
})

test("le comparateur au meilleur net ne présente aucune violation WCAG, en clair et en sombre", async ({ page }) => {
  await ouvrir(page)
  await page.getByRole("checkbox", { name: "Avec 4 trimestres de retraite" }).check()
  await expect(enTete(page, "SASU")).toContainText("avec 4 trimestres de retraite")
  await auditer(page, "comparateur au meilleur net, thème clair", "section[aria-labelledby=comparateur-titre]")
  await page.getByRole("switch", { name: "Changer de thème" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await auditer(page, "comparateur au meilleur net, thème sombre", "section[aria-labelledby=comparateur-titre]")
})

test.describe("sur un téléphone", () => {
  test.use({ viewport: { width: 375, height: 800 } })

  for (const police of POLICES) {
    test(`les réglages du meilleur net tiennent dans la largeur et ne présentent aucune violation WCAG, ${police}`, async ({ page, context }) => {
      await choisirLaPolice(context, police)
      await ouvrir(page)
      await expect(enTete(page, "EURL")).toContainText("rémunération optimale")
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
      await auditer(page, "comparateur au meilleur net, 375 px", "section[aria-labelledby=comparateur-titre]")
    })
  }
})
