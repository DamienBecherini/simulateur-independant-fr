// e2e-web/zoom-hauteur.web.ts
// Interface agrandie (boutons de zoom) dans une fenêtre basse : les fenêtres de dialogue tiennent dans la hauteur de
// l'écran. Sous le zoom CSS du body, Chromium agrandit aussi les unités vh : sans la division par --zoom (useZoom),
// « Situations types » mesurait 810 px de haut dans une fenêtre de 600 px, à 150 %.

import { test, expect } from "@playwright/test"

const HAUTEUR = 600

test.use({ viewport: { width: 1280, height: HAUTEUR } })

for (const zoom of [1.5, 2]) {
  test(`à ${zoom * 100} %, la fenêtre « Situations types » tient dans la hauteur de l'écran`, async ({ page }) => {
    await page.addInitScript(z => window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage: "resume", zoom: z })), zoom)
    await page.goto("./")
    await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.body.style.zoom)).toBe(String(zoom))

    await page.getByRole("button", { name: /Situations types/ }).first().click()
    const fenetre = page.getByRole("dialog").first()
    await expect(fenetre).toBeVisible()
    // Après l'animation d'ouverture.
    await expect.poll(async () => (await fenetre.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0)
    const cadre = (await fenetre.boundingBox())!
    expect(cadre.y + cadre.height).toBeLessThanOrEqual(HAUTEUR)
  })
}
