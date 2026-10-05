// e2e-web/annees.web.ts
// Plusieurs années dans la démo web : ajout d'une année, passage de l'une à l'autre, conservation dans le navigateur.

import { writeFile } from "node:fs/promises"
import { test, expect, type Page } from "@playwright/test"

async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByText(/année 2026 avec les règles fiscales 2026/)).toBeVisible()
}

const anneeAffichee = (page: Page) => page.getByRole("group", { name: "Année affichée" }).getByRole("button", { pressed: true })

test("ajouter 2024 vide, y passer, la retrouver après rechargement, puis la supprimer", async ({ page }) => {
  await ouvrir(page)
  await expect(anneeAffichee(page)).toHaveText("2026")

  // 2025, puis 2024, avec des grilles vides.
  for (const annee of ["2025", "2024"]) {
    await page.getByRole("button", { name: "Ajouter une année" }).click()
    await page.getByRole("radio", { name: new RegExp(`^${annee}, avant`) }).check()
    await page.getByRole("radio", { name: "Commencer avec une grille vide" }).check()
    await page.getByRole("button", { name: `Ajouter ${annee}` }).click()
    await expect(anneeAffichee(page)).toHaveText(annee)
  }
  await expect(page.getByText(/année 2024 avec les règles fiscales 2024/)).toBeVisible()
  const synthese = page.getByRole("table", { name: /chaque année de la session/ })
  await expect(synthese.getByRole("rowheader")).toHaveText(["2024", "2025", "2026"])

  // Plus d'année avant 2024 : ses règles ne sont pas connues.
  await page.getByRole("button", { name: "Ajouter une année" }).click()
  await expect(page.getByRole("radio", { name: /^Pas d'année avant 2024/ })).toBeDisabled()
  await page.getByRole("button", { name: "Annuler" }).click()

  // Retour sur 2026, puis rechargement : les années sont conservées, l'affichage revient sur la plus récente.
  await page.getByRole("group", { name: "Année affichée" }).getByRole("button", { name: "2026" }).click()
  await expect(page.getByText(/année 2026 avec les règles fiscales 2026/)).toBeVisible()
  // La sauvegarde automatique part une seconde après la dernière modification : on attend qu'elle soit écrite.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("simulateur.session") ?? "{}").annees?.map((a: { annee: number }) => a.annee))).toEqual([2024, 2025, 2026])
  await page.reload()
  await expect(page.getByText(/année 2026 avec les règles fiscales 2026/)).toBeVisible()
  await expect(page.getByRole("group", { name: "Année affichée" }).getByRole("button")).toHaveText(["2024", "2025", "2026"])

  // Suppression de 2024, après confirmation.
  await page.getByRole("group", { name: "Année affichée" }).getByRole("button", { name: "2024" }).click()
  await page.getByRole("button", { name: "Supprimer 2024" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer 2024" }).click()
  await expect(page.getByRole("group", { name: "Année affichée" }).getByRole("button")).toHaveText(["2025", "2026"])
  await expect(anneeAffichee(page)).toHaveText("2026")
})

test("un fichier de plusieurs années modifié à la main : année en double écartée, 2023 affichée mais non simulée", async ({ page }, testInfo) => {
  await ouvrir(page)
  const grille = (montantDeJanvier: number | null) =>
    Array.from({ length: 12 }, (_, month) => ({ month, flows: month === 0 && montantDeJanvier !== null ? [{ id: `revenu-${montantDeJanvier}`, entityId: "person-alice", type: "other_taxable_income", label: "Revenu", amount: montantDeJanvier }] : [] }))
  const fichier = testInfo.outputPath("plusieurs-annees.json")
  await writeFile(
    fichier,
    JSON.stringify({
      formatVersion: 3,
      name: "Écrit à la main",
      entities: [{ id: "person-alice", type: "person", name: "Alice Martin", fiscalParts: 1, avatar: { type: "initials", value: "AM", color: "#3b82f6" }, locked: false }],
      relationships: [],
      // Années dans le désordre, 2024 en double : la seconde est écartée avec son flux.
      annees: [
        { annee: 2024, monthlyData: grille(1000) },
        { annee: 2023, monthlyData: grille(null) },
        { annee: 2024, monthlyData: grille(5000) }
      ]
    })
  )

  await page.getByRole("button", { name: "Paramètres" }).click()
  await page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: "Charger une sauvegarde..." }).click()
  const selecteur = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: "Importer une simulation..." }).click()
  await (await selecteur).setFiles(fichier)
  const confirmation = page.getByRole("dialog", { name: "Fichier importé avec des ajustements" })
  await expect(confirmation).toContainText("Flux invalides ou orphelins supprimés : 1")
  await confirmation.getByRole("button", { name: "Oui, continuer" }).click()

  // Les années sont remises dans l'ordre ; la plus récente est affichée, avec le revenu de la première 2024 du fichier.
  const annees = page.getByRole("group", { name: "Année affichée" }).getByRole("button")
  await expect(annees).toHaveText(["2023", "2024"])
  await expect(anneeAffichee(page)).toHaveText("2024")
  await expect(page.getByText(/année 2024 avec les règles fiscales 2024/)).toBeVisible()
  await expect(page.getByRole("button", { name: "Flux de janvier : Alice Martin" })).toContainText(/1\s000/)

  // 2023 se consulte mais ne se simule pas ; on ne peut rien ajouter avant elle.
  await annees.filter({ hasText: "2023" }).click()
  await expect(page.getByText("Le simulateur ne connaît pas les règles d'avant 2024 : l'année 2023 n'est pas simulée.").first()).toBeVisible()
  await page.getByRole("button", { name: "Ajouter une année" }).click()
  await expect(page.getByRole("radio", { name: /^Pas d'année avant 2023/ })).toBeDisabled()
  await page.getByRole("button", { name: "Annuler" }).click()

  // Elle se supprime, puis la seule année qui reste ne se supprime plus.
  await page.getByRole("button", { name: "Supprimer 2023" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer 2023" }).click()
  await expect(annees).toHaveText(["2024"])
  await expect(page.getByRole("button", { name: /^Supprimer 20/ })).toHaveCount(0)
})

test("une année ajoutée après la dernière connue est simulée avec les règles de 2026, et le dit", async ({ page }) => {
  await ouvrir(page)

  await page.getByRole("button", { name: "Ajouter une année" }).click()
  await page.getByRole("button", { name: "Ajouter 2027" }).click()

  await expect(page.getByText(/année 2027 avec les règles fiscales 2026/)).toBeVisible()
  await expect(page.getByText(/^Les règles de 2027 ne sont pas encore connues/)).toBeVisible()
  // Les flux de 2026 ont été recopiés : la grille de 2027 n'est pas vide.
  await expect(page.getByRole("button", { name: /^Flux de janvier : Atelier de Camille/ })).toContainText(/\d/)
  // Mêmes flux, mêmes règles : 2026 et 2027 ont le même net, comme le montre la synthèse.
  const nets = await page.getByRole("table", { name: /chaque année de la session/ }).getByRole("row").evaluateAll(lignes => lignes.slice(1).map(ligne => ligne.querySelectorAll("td")[0]?.textContent))
  expect(nets).toHaveLength(2)
  expect(nets[0]).toBe(nets[1])
})
