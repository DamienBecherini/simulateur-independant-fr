// e2e-web/grille-contraste.web.ts
// Contraste des textes de la grille mensuelle, calculé dans le navigateur, en clair et en sombre. L'audit axe-core ne
// suffit pas ici : il ignore un texte fait seulement de ponctuation (le « — » d'un acteur sans flux) ou d'un seul
// caractère (numéro au-dessus d'une barre), et ne se prononce pas devant une teinte posée en image de fond (lignes
// zébrées) : ces textes ne sont ni signalés ni vérifiés.

import { test, expect, type Page } from "@playwright/test"
import { contrastesDesTextes } from "./support/contraste"

/** Seuil WCAG AA d'un texte de taille normale : tous ceux de la grille le sont (text-sm, text-xs). */
const SEUIL = 4.5

const totaux = (page: Page) => page.getByRole("group", { name: /^Total annuel : / })

async function verifier(page: Page, theme: string) {
  // Aucune case survolée : le survol change le fond d'une case de mois.
  await page.mouse.move(0, 0)
  // Au changement de thème, les fonds des cases passent en fondu : on attend leur couleur finale.
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== "running"))
  const textes = await contrastesDesTextes(page.locator("[role=group][aria-label^='Total annuel : '], [role=button][aria-label^='Flux ']"))
  expect(textes.length).toBeGreaterThan(10)
  const insuffisants =textes.filter(t => t.rapport < SEUIL)
  expect(insuffisants, `${theme} : ${JSON.stringify(insuffisants)}`).toEqual([])
}

test("les textes de la grille, « — » du total annuel compris, dépassent 4,5:1 en clair et en sombre, lignes zébrées comprises", async ({ page }) => {
  await page.goto("./")
  await expect(totaux(page).first()).toBeVisible()
  // L'exemple a des acteurs sans flux sur une ligne ordinaire et sur une ligne zébrée : leur total affiche « — ».
  const sansFlux = await totaux(page).evaluateAll(cases => cases.filter(c => c.textContent!.trim() === "—").map(c => c.classList.contains("case-de-bande")))
  expect(sansFlux).toContain(true)
  expect(sansFlux).toContain(false)

  await verifier(page, "thème clair")
  await page.getByRole("switch", { name: "Changer de thème" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await verifier(page, "thème sombre")
})
