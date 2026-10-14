// e2e-web/grille-tactile.web.ts
// La grille sur un écran tactile, où rien ne s'éclaire au survol : une phrase dit qu'une case se touche, jusqu'à la
// première case touchée, et ne revient plus, même au rechargement.

import { test, expect } from "@playwright/test"

const AIDE = "Touchez une case pour saisir un montant."

test.describe("sur un téléphone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  test("l'aide de la grille s'affiche jusqu'à la première case touchée, puis ne revient plus", async ({ page }) => {
    await page.goto("./")
    const aide = page.getByText(AIDE)
    await expect(aide).toBeVisible()
    // Les cases vides invitent à toucher, sans changer leur nom accessible.
    await expect(page.getByRole("button", { name: "Flux de janvier : Camille Martin" })).toContainText("+ Ajouter")

    await page.getByRole("button", { name: "Flux de janvier : Camille Martin" }).tap()
    const fenetre = page.getByRole("dialog")
    await expect(fenetre).toBeVisible()
    await fenetre.getByRole("button", { name: "Terminé" }).tap()
    await expect(fenetre).toBeHidden()
    await expect(aide).toHaveCount(0)

    await expect.poll(() => page.evaluate(() => window.localStorage.getItem("simulateur.preferences"))).toContain('"grilleTouchee":true')
    await page.reload()
    await expect(page.getByRole("button", { name: "Flux de janvier : Camille Martin" })).toBeVisible()
    await expect(page.getByText(AIDE)).toHaveCount(0)
  })
})

test("l'aide de la grille ne s'affiche pas à la souris", async ({ page }) => {
  await page.goto("./")
  await expect(page.getByRole("button", { name: "Flux de janvier : Camille Martin" })).toBeVisible()
  await expect(page.getByText(AIDE)).toBeHidden()
})
