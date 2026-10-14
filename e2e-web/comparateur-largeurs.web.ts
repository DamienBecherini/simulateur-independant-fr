// e2e-web/comparateur-largeurs.web.ts
// Tableau du comparateur : ses colonnes de statut gardent une largeur minimale lisible (le tableau défile en largeur
// plutôt que de les serrer jusqu'à la largeur d'un mot), plus petite sur un téléphone étroit, et la colonne des libellés
// reste visible quand on fait défiler.

import { test, expect, type Page } from "@playwright/test"
import { choisirAvantLeChargement, deplierLeTableauDuComparateur } from "./support/affichage"

const tableau = (page: Page) => page.getByRole("table", { name: "Comparaison des statuts" })

/** Largeur de chaque case de l'en-tête (libellés, puis statuts), sa largeur minimale calculée, et la zone qui défile. */
function mesurer(page: Page) {
  return tableau(page).evaluate(table => {
    const zone = table.closest("[role=region]") ?? table.parentElement!
    const cases = Array.from(table.querySelectorAll("thead th")).map(th => ({ largeur: th.getBoundingClientRect().width, minimum: parseFloat(getComputedStyle(th).minWidth) || 0, gauche: th.getBoundingClientRect().left }))
    const bords = zone.getBoundingClientRect()
    return { cases, zone: { gauche: bords.left, droite: bords.right }, defile: zone.scrollWidth > zone.clientWidth }
  })
}

/** Chaque colonne de statut a au moins son minimum, qui est celui attendu à cette largeur d'écran. */
async function verifierLesMinimums(page: Page, minimumAttendu: number) {
  const { cases, defile } = await mesurer(page)
  const statuts = cases.slice(1)
  expect(statuts.length).toBeGreaterThanOrEqual(4)
  for (const [i, c] of statuts.entries()) {
    expect(c.minimum, `colonne ${i + 1}`).toBe(minimumAttendu)
    expect(c.largeur, `colonne ${i + 1}`).toBeGreaterThanOrEqual(minimumAttendu - 0.5)
  }
  return { cases, defile }
}

/** Fait défiler le tableau jusqu'au bout : la colonne des libellés reste à gauche de la zone, visible. */
async function verifierLaColonneFixe(page: Page) {
  await tableau(page).evaluate(table => {
    const zone = table.closest("[role=region]") ?? table.parentElement!
    zone.scrollIntoView({ block: "center" })
    zone.scrollLeft = zone.scrollWidth
  })
  expect(await tableau(page).evaluate(table => (table.closest("[role=region]") ?? table.parentElement!).scrollLeft)).toBeGreaterThan(0)
  const { cases, zone } = await mesurer(page)
  expect(Math.abs(cases[0].gauche - zone.gauche)).toBeLessThanOrEqual(2)
  await expect(tableau(page).getByRole("rowheader", { name: "Net dans la poche" })).toBeInViewport()
}

test.describe("à 1 100 px de large", () => {
  test.use({ viewport: { width: 1100, height: 900 } })

  test("les colonnes de statut gardent 10rem au moins : le tableau défile, la colonne des libellés reste visible", async ({ page }) => {
    await page.goto("./")
    await deplierLeTableauDuComparateur(page)
    const { defile } = await verifierLesMinimums(page, 160)
    expect(defile).toBe(true)
    await verifierLaColonneFixe(page)
  })
})

test.describe("à 360 px de large (téléphone étroit)", () => {
  test.use({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true })

  test("affichage classique : 8,5rem au moins par statut, le libellé et un peu plus d'une colonne de statut sont visibles", async ({ page }) => {
    await choisirAvantLeChargement(page, "classique")
    await page.goto("./")
    await expect(tableau(page)).toBeVisible()
    const { cases, defile } = await verifierLesMinimums(page, 136)
    expect(defile).toBe(true)
    // Le libellé, la première colonne de statut en entier et le début de la suivante : on comprend que le tableau défile.
    const { zone } = await mesurer(page)
    expect(cases[1].gauche + cases[1].largeur).toBeLessThanOrEqual(zone.droite)
    expect(cases[2].gauche).toBeLessThan(zone.droite - 24)
    await verifierLaColonneFixe(page)
  })

  test("affichage « Résumé » : le tableau, remplacé par des cartes, n'apparaît qu'avec le détail, aux mêmes largeurs", async ({ page }) => {
    await page.goto("./")
    await expect(page.getByRole("list", { name: "Net dans la poche selon le statut" })).toBeVisible()
    await expect(tableau(page)).toBeHidden()
    await deplierLeTableauDuComparateur(page)
    await verifierLesMinimums(page, 136)
    await verifierLaColonneFixe(page)
  })
})
