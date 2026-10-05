// e2e-web/annees-grille.web.ts
// Saisie sur plusieurs années depuis la fenêtre des flux : une charge ajoutée à tous les mois de 2026 et de 2025
// d'un coup, puis supprimée des deux années, et l'annulation qui la rétablit en une seule étape.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"

/** Ouvre la démo (2026) et lui ajoute 2025, vide, puis revient sur 2026. */
async function ouvrirAvec2025(page: Page) {
  await page.goto("./")
  await expect(page.getByText(/année 2026 avec les règles fiscales 2026/)).toBeVisible()
  await page.getByRole("button", { name: "Ajouter une année" }).click()
  await page.getByRole("radio", { name: /^2025, avant/ }).check()
  await page.getByRole("radio", { name: "Commencer avec une grille vide" }).check()
  await page.getByRole("button", { name: "Ajouter 2025" }).click()
  await afficher(page, "2026")
}

async function afficher(page: Page, annee: string) {
  await page.getByRole("group", { name: "Année affichée" }).getByRole("button", { name: annee }).click()
  await expect(page.getByText(new RegExp(`année ${annee} avec les règles fiscales`))).toBeVisible()
}

/** Total annuel des dépenses de la société, lu dans la colonne « Total Annuel » de la grille ; 0 si elle n'a aucun flux. */
async function depensesAnnuelles(page: Page): Promise<number> {
  const montants = page.getByRole("group", { name: "Total annuel : Conseil SASU" }).locator(".font-mono")
  if ((await montants.count()) === 0) return 0
  return Number((await montants.last().innerText()).replace(/\D/g, ""))
}

test("ajouter une charge à tous les mois de 2026 et de 2025, la supprimer des deux, puis annuler", async ({ page }) => {
  await ouvrirAvec2025(page)
  const avant = await depensesAnnuelles(page)
  const fenetre = page.getByRole("dialog")

  // Ajout en mars 2026, pour toute l'année, avec 2025 cochée.
  await page.getByRole("button", { name: "Flux de mars : Conseil SASU" }).click()
  const autresAnnees = fenetre.getByRole("group", { name: "Aussi en :" })
  await expect(autresAnnees.getByRole("checkbox")).toHaveCount(1)
  await fenetre.getByLabel("Appliquer à :").selectOption("annee")
  await autresAnnees.getByRole("checkbox", { name: "2025" }).check()
  await expect(fenetre.getByText("Les ajouts, modifications et suppressions s'appliquent aussi aux autres mois choisis, et aux mêmes mois en 2025.")).toBeVisible()
  await auditer(page, "fenêtre des flux, une autre année cochée", "[role=dialog]")
  await fenetre.getByRole("combobox", { name: "Type de flux" }).last().click()
  await page.getByRole("option", { name: /^Charge déductible/ }).click()
  await fenetre.getByLabel("Libellé du nouveau flux").fill("Logiciel")
  await fenetre.getByLabel("Montant du nouveau flux").fill("100")
  await fenetre.getByLabel("Montant du nouveau flux").press("Enter")
  await expect(page.getByText("Flux ajouté à ce mois et recopié sur 12 mois en 2025 et 11 mois en 2026.")).toBeVisible()
  await fenetre.getByRole("button", { name: "Terminé" }).click()

  await expect.poll(() => depensesAnnuelles(page)).toBe(avant + 1200)
  await afficher(page, "2025")
  await expect.poll(() => depensesAnnuelles(page)).toBe(1200)

  // Suppression depuis 2025, pour toute l'année, avec 2026 cochée.
  await page.getByRole("button", { name: "Flux de mars : Conseil SASU" }).click()
  await fenetre.getByLabel("Appliquer à :").selectOption("annee")
  await fenetre.getByRole("group", { name: "Aussi en :" }).getByRole("checkbox", { name: "2026" }).check()
  await fenetre.getByRole("button", { name: "Supprimer le flux" }).click()
  await expect(page.getByText("Supprimé aussi sur 11 mois en 2025 et 12 mois en 2026.")).toBeVisible()
  await fenetre.getByRole("button", { name: "Terminé" }).click()
  await expect.poll(() => depensesAnnuelles(page)).toBe(0)
  await afficher(page, "2026")
  await expect.poll(() => depensesAnnuelles(page)).toBe(avant)

  // Une seule annulation rétablit la charge dans les deux années.
  await page.getByRole("button", { name: "Annuler", exact: true }).click()
  await expect.poll(() => depensesAnnuelles(page)).toBe(avant + 1200)
  await afficher(page, "2025")
  await expect.poll(() => depensesAnnuelles(page)).toBe(1200)
})

test.describe("sur un téléphone", () => {
  test.use({ viewport: { width: 375, height: 800 } })

  test("les cases des autres années tiennent dans la largeur et mesurent au moins 24 px", async ({ page }) => {
    await ouvrirAvec2025(page)
    await page.getByRole("button", { name: "Flux de mars : Conseil SASU" }).click()
    const autresAnnees = page.getByRole("dialog").getByRole("group", { name: "Aussi en :" })
    await autresAnnees.getByRole("checkbox", { name: "2025" }).check()

    const zone = await autresAnnees.locator("label").first().boundingBox()
    expect(zone?.width).toBeGreaterThanOrEqual(24)
    expect(zone?.height).toBeGreaterThanOrEqual(24)
    const groupe = await autresAnnees.boundingBox()
    expect((groupe?.x ?? 0) + (groupe?.width ?? 0)).toBeLessThanOrEqual(375)
    await auditer(page, "fenêtre des flux à 375 px, une autre année cochée", "[role=dialog]")
  })
})
