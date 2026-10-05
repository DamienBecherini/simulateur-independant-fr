// e2e-web/annees-limite.web.ts
// Dix années dans la démo web, le maximum d'une session : ajout désactivé et expliqué, raccourcis pour cocher les
// années dans la fenêtre des flux, synthèse qui défile avec la colonne des années fixe, pas de défilement de la page
// sur téléphone, accessibilité en thème clair et sombre. Et un fichier refusé parce que ses années ne se suivent pas.

import { writeFile } from "node:fs/promises"
import { test, expect, type Page, type TestInfo } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"

const DIX_ANNEES = Array.from({ length: 10 }, (_, i) => 2024 + i)

/** Une grille dont janvier porte un revenu, pour que chaque année ait un résultat. */
const grille = (montant: number) => Array.from({ length: 12 }, (_, month) => ({ month, flows: month === 0 ? [{ id: `revenu-${montant}`, entityId: "person-alice", type: "other_taxable_income", label: "Revenu", amount: montant }] : [] }))

/** Écrit un fichier de simulation à la main, avec les années données, et renvoie son chemin. */
async function fichierDesAnnees(testInfo: TestInfo, nom: string, annees: number[]): Promise<string> {
  const chemin = testInfo.outputPath(`${nom}.json`)
  await writeFile(
    chemin,
    JSON.stringify({
      formatVersion: 3,
      name: "Écrit à la main",
      entities: [{ id: "person-alice", type: "person", name: "Alice Martin", fiscalParts: 1, avatar: { type: "initials", value: "AM", color: "#3b82f6" }, locked: false }],
      relationships: [],
      annees: annees.map((annee, i) => ({ annee, monthlyData: grille(20_000 + 1000 * i) }))
    })
  )
  return chemin
}

/** Ouvre la démo et importe le fichier, comme le ferait l'utilisateur. */
async function importer(page: Page, fichier: string) {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await page.getByRole("button", { name: "Paramètres" }).click()
  await page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: "Charger une sauvegarde..." }).click()
  const selecteur = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: "Importer une simulation..." }).click()
  await (await selecteur).setFiles(fichier)
}

/** Importe une session de dix années, de 2024 à 2033 ; la plus récente est affichée. */
async function ouvrirDixAnnees(page: Page, testInfo: TestInfo) {
  await importer(page, await fichierDesAnnees(testInfo, "dix-annees", DIX_ANNEES))
  // Le panneau des paramètres reste ouvert derrière (et rend la page inerte) : on le ferme.
  // Le nom du fichier est gardé à l'import.
  await expect(page.locator("h1")).toHaveText("Écrit à la main")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toBeHidden()
  await expect(page.getByRole("group", { name: "Année affichée" }).getByRole("button")).toHaveText(DIX_ANNEES.map(String))
  await expect(page.getByText(/année 2033 avec les règles fiscales 2026/)).toBeVisible()
}

/** Ouvre la fenêtre des flux de janvier et renvoie le groupe des autres années. */
async function ouvrirLesFluxDeJanvier(page: Page) {
  await page.getByRole("button", { name: "Flux de janvier : Alice Martin" }).click()
  const annees = page.getByRole("dialog").getByRole("group", { name: "Aussi en :" })
  await expect(annees).toBeVisible()
  return annees
}

/** Ce qui dépasse en largeur : la page elle-même. */
const largeurDeLaPage = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth)

test("à dix années, l'ajout est désactivé et expliqué ; la fenêtre des flux propose des raccourcis", async ({ page }, testInfo) => {
  await ouvrirDixAnnees(page, testInfo)

  const ajouter = page.getByRole("button", { name: "Ajouter une année" })
  await expect(ajouter).toBeDisabled()
  await expect(ajouter).toHaveAccessibleDescription(/^10 années au plus : au-delà de deux ou trois ans après les dernières règles connues, les chiffres ne sont plus qu'une projection\./)
  await expect(page.getByText(/^10 années au plus/)).toBeVisible()

  // Une extrémité supprimée, l'ajout redevient possible ; annulé, la limite revient.
  await page.getByRole("button", { name: "Supprimer 2033" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer 2033" }).click()
  await expect(ajouter).toBeEnabled()
  await expect(page.getByText(/^10 années au plus/)).toBeHidden()
  await page.getByRole("button", { name: "Annuler", exact: true }).click()
  await expect(ajouter).toBeDisabled()

  // Depuis 2028, au milieu : neuf autres années, et les quatre raccourcis.
  await page.getByRole("group", { name: "Année affichée" }).getByRole("button", { name: "2028" }).click()
  const annees = await ouvrirLesFluxDeJanvier(page)
  const cochees = () => annees.getByRole("checkbox", { checked: true })
  await expect(annees.getByRole("checkbox")).toHaveCount(9)

  await annees.getByRole("button", { name: "Cocher les années précédentes" }).click()
  await expect(cochees()).toHaveCount(4)
  await expect(page.getByText("Les ajouts, modifications et suppressions s'appliquent aussi au même mois en 2024, 2025, 2026 et 2027.")).toBeVisible()
  await annees.getByRole("button", { name: "Cocher les années suivantes" }).click()
  await expect(cochees()).toHaveCount(5)
  await expect(annees.getByRole("checkbox", { name: "2029" })).toBeChecked()
  await annees.getByRole("button", { name: "Cocher toutes les années" }).click()
  await expect(cochees()).toHaveCount(9)
  await annees.getByRole("button", { name: "Ne cocher aucune année" }).click()
  await expect(cochees()).toHaveCount(0)
  await expect(page.getByText(/s'appliquent aussi/)).toBeHidden()
})

test("dix années ne présentent aucune violation WCAG, en thème clair comme en thème sombre", async ({ page }, testInfo) => {
  await ouvrirDixAnnees(page, testInfo)
  await expect(page.getByRole("table", { name: /chaque année de la session/ })).toBeVisible()

  for (const theme of ["thème clair", "thème sombre"]) {
    if (theme === "thème sombre") {
      await page.getByRole("switch", { name: "Changer de thème" }).click()
      await expect(page.locator("html")).toHaveClass(/dark/)
    }
    await auditer(page, `dix années, ${theme}`)
    const annees = await ouvrirLesFluxDeJanvier(page)
    await annees.getByRole("button", { name: "Cocher toutes les années" }).click()
    await auditer(page, `fenêtre des flux avec raccourcis, ${theme}`, "[role=dialog]")
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden()
  }
})

test.describe("sur un téléphone", () => {
  test.use({ viewport: { width: 375, height: 800 } })

  test("dix années tiennent dans la largeur : la synthèse défile seule, au clavier, colonne des années fixe", async ({ page }, testInfo) => {
    await ouvrirDixAnnees(page, testInfo)
    expect(await largeurDeLaPage(page)).toBeLessThanOrEqual(375)

    // La synthèse défile dans sa région, au clavier ; la colonne des années reste au bord gauche.
    const region = page.getByRole("region", { name: "Synthèse des années" })
    await region.scrollIntoViewIfNeeded()
    expect(await region.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
    await region.focus()
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight")
    await expect.poll(() => region.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
    const bordGauche = (await region.boundingBox())!.x
    for (const cellule of [region.getByRole("columnheader", { name: "Année" }), region.getByRole("rowheader", { name: "2024" }), region.getByRole("rowheader", { name: /^2033/ })]) {
      expect(Math.abs((await cellule.boundingBox())!.x - bordGauche)).toBeLessThan(1)
    }
    // Le fond de la colonne fixe est opaque : les montants qui passent dessous ne se voient pas au travers.
    const fond = await region.getByRole("rowheader", { name: "2024" }).evaluate(element => getComputedStyle(element).backgroundColor)
    expect(fond).not.toMatch(/rgba\(.*, 0\)|transparent/)

    // La fenêtre des flux, avec ses raccourcis et ses neuf cases, ne déborde pas non plus.
    await ouvrirLesFluxDeJanvier(page)
    const fenetre = page.getByRole("dialog")
    expect(await fenetre.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    expect(await largeurDeLaPage(page)).toBeLessThanOrEqual(375)
    await auditer(page, "fenêtre des flux avec raccourcis, 375 px", "[role=dialog]")
  })
})

test("un fichier dont les années ne se suivent pas est refusé, avec les années manquantes", async ({ page }, testInfo) => {
  await importer(page, await fichierDesAnnees(testInfo, "annees-trouees", [2024, 2027, 2028]))

  await expect(page.getByText("Import impossible. Les années de cette simulation ne se suivent pas : il manque 2025 et 2026 entre 2024 et 2028.", { exact: false })).toBeVisible()
  // La simulation en cours n'est pas remplacée.
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toBeHidden()
  await expect(page.getByRole("group", { name: "Année affichée" }).getByRole("button")).toHaveText(["2026"])
  await expect(page.getByRole("button", { name: /^Flux de janvier : Alice Martin/ })).toHaveCount(0)
})

test("un fichier de plus de dix années est refusé", async ({ page }, testInfo) => {
  await importer(page, await fichierDesAnnees(testInfo, "onze-annees", [...DIX_ANNEES, 2034]))

  await expect(page.getByText(/Import impossible\. Cette simulation contient 11 années, de 2024 à 2034 ; le simulateur en accepte au plus 10\./)).toBeVisible()
})
