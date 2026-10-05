// e2e-web/annees.web.ts
// Plusieurs années dans la démo web : ajout d'une année, passage de l'une à l'autre, conservation dans le navigateur.

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
