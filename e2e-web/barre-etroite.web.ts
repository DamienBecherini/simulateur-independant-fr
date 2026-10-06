// e2e-web/barre-etroite.web.ts
// Selon la largeur, « Donner mon avis » et « Montages types » montrent leur nom dans la barre d'outils, ou leur icône seule.
// Sur un téléphone de 320 px, la barre d'outils tient dans l'écran : l'interrupteur de thème et les montages types passent dans le panneau
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
    // Les montages types aussi : ils restent dans le panneau des paramètres.
    await expect(barre.getByRole("button", { name: "Montages types" })).toBeHidden()

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

// Le nom visible de chaque bouton, selon la largeur : les deux à partir de 1024 px, « Montages types » seul à partir de 768 px.
const LARGEURS = [
  { largeur: 1440, avis: true, montages: true },
  { largeur: 800, avis: false, montages: true },
  { largeur: 375, avis: false, montages: false }
]

for (const { largeur, avis, montages } of LARGEURS) {
  test(`à ${largeur} px, la barre d'outils montre ${avis ? "les noms des deux boutons" : montages ? "le nom de « Montages types » seulement" : "les icônes seules"}, et tient dans l'écran`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 800 })
    await page.goto("./")
    const barre = page.getByRole("navigation", { name: "Barre d'outils" })
    const boutonDAvis = barre.getByRole("button", { name: "Donner mon avis" })
    const boutonDesMontages = barre.getByRole("button", { name: "Montages types" })
    await expect(boutonDAvis.getByText("Donner mon avis")).toBeVisible({ visible: avis })
    await expect(boutonDesMontages.getByText("Montages types")).toBeVisible({ visible: montages })
    const debordements = await barre.evaluate(nav => Array.from(nav.querySelectorAll("button")).filter(el => el.getBoundingClientRect().right > window.innerWidth).length)
    expect(debordements).toBe(0)

    await boutonDesMontages.click()
    await expect(page.getByRole("dialog", { name: "Partir d'un montage type" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(boutonDesMontages).toBeFocused()
  })
}
