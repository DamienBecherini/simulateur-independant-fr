// e2e-web/courbe-au-doigt.web.ts
// La courbe « Rémunération ou dividendes ? » sur un écran tactile, où rien ne se survole : un toucher affiche les
// valeurs du point le plus proche, qui restent une fois le doigt levé, jusqu'au toucher suivant, ailleurs. Une phrase
// le dit sous la courbe, sur écran tactile seulement.

import { test, expect, type Page } from "@playwright/test"

const courbe = (page: Page) => page.getByRole("group", { name: /^Net du foyer selon la rémunération nette en SASU/ })
const valeurs = (page: Page) => courbe(page).locator("xpath=..").getByRole("status")
const invitation = (page: Page) => page.getByText("Touchez la courbe, ou faites-y glisser le doigt, pour lire ses valeurs.")

async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(courbe(page)).toBeVisible()
  await courbe(page).scrollIntoViewIfNeeded()
}

test.describe("sur un téléphone tactile de 375 px", () => {
  test.use({ viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true })

  test("un toucher sur la courbe affiche ses valeurs, qui restent jusqu'au toucher suivant, ailleurs", async ({ page }) => {
    await ouvrir(page)
    await expect(invitation(page)).toBeVisible()
    await expect(valeurs(page)).toHaveCount(0)

    const boite = (await courbe(page).boundingBox())!
    await page.touchscreen.tap(boite.x + boite.width * 0.5, boite.y + boite.height * 0.5)
    await expect(valeurs(page)).toBeVisible()
    await expect(valeurs(page)).toContainText("dans la poche du foyer")
    await expect(valeurs(page)).toContainText("Rémunération")
    const auMilieu = await valeurs(page).innerText()
    // La bulle tient dans la largeur de l'écran.
    const bulle = (await valeurs(page).boundingBox())!
    expect(bulle.x).toBeGreaterThanOrEqual(0)
    expect(bulle.x + bulle.width).toBeLessThanOrEqual(375)

    // Un autre toucher, plus à droite : un autre point.
    await page.touchscreen.tap(boite.x + boite.width * 0.85, boite.y + boite.height * 0.5)
    await expect(valeurs(page)).not.toHaveText(auMilieu)

    // Un toucher hors de la courbe la referme.
    await page.touchscreen.tap(boite.x + boite.width * 0.5, boite.y - 30)
    await expect(valeurs(page)).toHaveCount(0)
  })
})

test("à la souris, les valeurs suivent le pointeur et disparaissent quand il quitte la courbe ; pas de phrase sur le toucher", async ({ page }) => {
  await ouvrir(page)
  await expect(invitation(page)).toBeHidden()
  const boite = (await courbe(page).boundingBox())!
  await page.mouse.move(boite.x + boite.width * 0.5, boite.y + boite.height * 0.5)
  await expect(valeurs(page)).toBeVisible()
  await page.mouse.move(boite.x + boite.width * 0.5, boite.y - 40)
  await expect(valeurs(page)).toHaveCount(0)
})
