// e2e-web/mentions-legales.web.ts
// « Mentions légales et confidentialité » dans la démo web : ouverture depuis le pied de page, les paramètres et
// l'adresse #mentions-legales (sans changer de vue dans l'affichage « Trois vues »), accessibilité en thème clair et
// sombre, largeur sur téléphone avec la police du système et une police large.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"
import { choisirAvantLeChargement } from "./support/affichage"
import { choisirLaPolice, POLICES } from "./support/police"

const NOM = "Mentions légales et confidentialité"

const fenetre = (page: Page) => page.getByRole("dialog", { name: NOM })

/** Ouvre la démo, à une adresse donnée, et attend la simulation d'exemple. */
async function ouvrir(page: Page, adresse = "") {
  await page.goto(`./${adresse}`)
  await expect(page.getByText(/avec les règles fiscales \d{4}/).first()).toBeAttached()
}

async function ouvrirDepuisLePiedDePage(page: Page) {
  const bouton = page.getByRole("contentinfo").getByRole("button", { name: NOM })
  await bouton.click()
  await expect(fenetre(page)).toBeVisible()
  return bouton
}

test("s'ouvrent depuis le pied de page, titre en tête, et rendent le focus au bouton", async ({ page }) => {
  await ouvrir(page)
  const bouton = await ouvrirDepuisLePiedDePage(page)
  await expect(fenetre(page).getByRole("heading", { level: 2, name: NOM })).toBeFocused()
  for (const rubrique of ["Éditeur", "Hébergement", "Données personnelles et confidentialité", "Cookies et traceurs", "Avertissement", "Licence et code source", "Mise à jour"]) {
    await expect(fenetre(page).getByRole("heading", { level: 3, name: rubrique })).toBeVisible()
  }
  await expect(fenetre(page).getByRole("link", { name: /^licence MIT/ })).toHaveAttribute("target", "_blank")
  await page.keyboard.press("Escape")
  await expect(fenetre(page)).toBeHidden()
  await expect(bouton).toBeFocused()
})

test("s'ouvrent depuis les paramètres", async ({ page }) => {
  await ouvrir(page)
  await page.getByRole("button", { name: "Paramètres" }).click()
  await page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: NOM }).click()
  await expect(fenetre(page)).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(fenetre(page)).toBeHidden()
  await expect(page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: NOM })).toBeFocused()
})

test("s'ouvrent par leur adresse, et l'effacent à la fermeture", async ({ page }) => {
  await ouvrir(page, "#mentions-legales")
  await expect(fenetre(page)).toBeVisible()
  await fenetre(page).getByRole("button", { name: "Fermer" }).click()
  await expect(fenetre(page)).toBeHidden()
  expect(new URL(page.url()).hash).toBe("")
})

test("dans l'affichage « Trois vues », s'ouvrent par-dessus la vue affichée, qui garde son adresse", async ({ page }) => {
  await choisirAvantLeChargement(page, "vues")
  await ouvrir(page, "#resultats")
  await expect(page.getByRole("tab", { name: /résultats/i })).toHaveAttribute("aria-selected", "true")
  await page.evaluate(() => (window.location.hash = "#mentions-legales"))
  await expect(fenetre(page)).toBeVisible()
  // Sous la fenêtre, la page est masquée aux technologies d'assistance.
  await expect(page.getByRole("tab", { name: /résultats/i, includeHidden: true })).toHaveAttribute("aria-selected", "true")
  await page.keyboard.press("Escape")
  await expect(fenetre(page)).toBeHidden()
  expect(new URL(page.url()).hash).toBe("#resultats")
  await expect(page.getByRole("tab", { name: /résultats/i })).toHaveAttribute("aria-selected", "true")
})

test("ne présentent aucune violation WCAG, en thème clair comme en thème sombre", async ({ page }) => {
  await ouvrir(page)
  await ouvrirDepuisLePiedDePage(page)
  await auditer(page, "mentions légales, thème clair")
  await page.keyboard.press("Escape")
  await page.getByRole("switch", { name: "Changer de thème" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await ouvrirDepuisLePiedDePage(page)
  await auditer(page, "mentions légales, thème sombre")
})

for (const largeur of [320, 375]) {
  test.describe(`sur un téléphone de ${largeur} px`, () => {
    test.use({ viewport: { width: largeur, height: 700 } })

    for (const police of POLICES) {
      test(`tiennent dans la largeur, ${police}`, async ({ page, context }) => {
        await choisirLaPolice(context, police)
        await ouvrir(page, "#mentions-legales")
        await expect(fenetre(page)).toBeVisible()
        const debordements = await fenetre(page).evaluate(element => [element, ...Array.from(element.querySelectorAll("*"))].filter(e => !e.classList.contains("sr-only") && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "visible").map(e => e.outerHTML.slice(0, 80)))
        expect(debordements).toEqual([])
        const boite = await fenetre(page).boundingBox()
        expect(boite && boite.x >= 0 && boite.x + boite.width <= largeur).toBe(true)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur)
        // Le pied de page et son bouton tiennent aussi.
        await page.keyboard.press("Escape")
        const bouton = page.getByRole("contentinfo").getByRole("button", { name: NOM })
        const boiteDuBouton = await bouton.boundingBox()
        expect(boiteDuBouton && boiteDuBouton.x >= 0 && boiteDuBouton.x + boiteDuBouton.width <= largeur).toBe(true)
      })
    }
  })
}
