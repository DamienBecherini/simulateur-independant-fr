// e2e-web/barre-etroite.web.ts
// Sur un téléphone de 320 px, la barre d'outils tient dans l'écran : l'interrupteur de thème passe dans le panneau
// des paramètres, où il change le thème de la page comme celui de la barre.

import { test, expect } from "@playwright/test"

test.describe("sur un téléphone tactile de 320 px", () => {
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true })

  test("la barre d'outils tient dans l'écran, et le thème se change depuis les paramètres", async ({ page }) => {
    await page.goto("./")
    const barre = page.getByRole("navigation", { name: "Barre d'outils" })
    await expect(barre).toBeVisible()
    // Aucun bouton visible de la barre ne sort de l'écran.
    const debordements = await barre.evaluate(nav =>
      Array.from(nav.querySelectorAll("button, [role=switch]"))
        .filter(el => el.getBoundingClientRect().width > 0)
        .map(el => el.getBoundingClientRect().right)
        .filter(droite => droite > window.innerWidth)
    )
    expect(debordements).toEqual([])
    await expect(barre.getByRole("switch", { name: "Changer de thème" })).toBeHidden()

    await page.getByRole("button", { name: "Paramètres" }).click()
    const panneau = page.getByRole("dialog", { name: "Configuration" })
    // Les boutons du panneau (« Nouvelle Simulation / Réinitialiser », le plus long) passent à la ligne sans déborder.
    const boutonsQuiDebordent = await panneau.evaluate(dialogue => Array.from(dialogue.querySelectorAll("button")).filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent))
    expect(boutonsQuiDebordent).toEqual([])
    const interrupteur = panneau.getByRole("switch", { name: "Changer de thème" })
    const sombreAuDepart = await page.evaluate(() => document.documentElement.classList.contains("dark"))
    await interrupteur.click()
    await expect(page.locator("html")).toHaveClass(new RegExp(sombreAuDepart ? "light" : "dark"))
  })
})
