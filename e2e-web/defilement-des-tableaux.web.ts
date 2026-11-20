// e2e-web/defilement-des-tableaux.web.ts
// Un tableau plus large que sa zone dit qu'il défile : une ombre du côté où des colonnes sont cachées (claire en thème
// sombre), et une flèche qui y mène, au milieu de ce qui se voit du tableau. Les flèches suivent la page sans sauter,
// y compris avec l'interface agrandie ; un écran tactile n'en a pas (on y fait glisser le tableau), l'impression non plus.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"
import { deplierLeTableauDuComparateur } from "./support/affichage"

const SITUATION = "./#situation=sasu-en-zone-franche-urbaine"

const zone = (page: Page) => page.getByRole("region", { name: "Tableau de comparaison" })
const fleche = (page: Page, cote: "gauche" | "droite") => zone(page).locator("xpath=..").getByRole("button", { name: `Voir les colonnes de ${cote}` })
const ombre = (page: Page, cote: "gauche" | "droite") => zone(page).locator("xpath=..").locator(`[data-ombre="${cote}"]`)

interface Cadre {
  haut: number
  bas: number
  gauche: number
  droite: number
}

/** Les cadres, en pixels d'écran : le tableau, ses deux flèches, et le bas des barres collées en haut de la fenêtre. */
async function mesurer(page: Page): Promise<{ tableau: Cadre; gauche: Cadre; droite: Cadre; barres: number; fenetre: number }> {
  // D'autres tableaux de la page défilent à cette largeur (les frais de fonctionnement) : on mesure celui du comparateur.
  return zone(page).evaluate(element => {
    const cadre = (e: Element) => {
      const r = e.getBoundingClientRect()
      return { haut: r.top, bas: r.bottom, gauche: r.left, droite: r.right }
    }
    const [gauche, droite] = Array.from(element.parentElement!.querySelectorAll("[data-fleches-de-defilement] button"), cadre)
    const barres = Math.max(...Array.from(document.querySelectorAll("nav[aria-label=\"Barre d'outils\"], [data-barre-visible]"), barre => barre.getBoundingClientRect().bottom))
    return { tableau: cadre(element.parentElement!), gauche, droite, barres, fenetre: window.innerHeight }
  })
}

const milieu = (cadre: Cadre) => (cadre.haut + cadre.bas) / 2

/** Le milieu de ce qui se voit du tableau, sous les barres collées en haut. */
const milieuVisible = ({ tableau, barres, fenetre }: { tableau: Cadre; barres: number; fenetre: number }) => (Math.max(tableau.haut, barres) + Math.min(tableau.bas, fenetre)) / 2

/** Amène le haut du tableau (ou son bas) à cette distance du haut de la fenêtre, en pixels d'écran. */
async function placerLeTableau(page: Page, distance: number, bord: "top" | "bottom" = "top") {
  const ecart = () => zone(page).evaluate((element, [cible, cote]) => element.getBoundingClientRect()[cote] - cible, [distance, bord] as const)
  // La page finit parfois de se mettre en place (tableau déplié, barre de résumé) : on recommence jusqu'à y être.
  await expect(async () => {
    await page.evaluate(top => window.scrollBy({ top, behavior: "instant" }), await ecart())
    expect(Math.abs(await ecart())).toBeLessThanOrEqual(1)
  }).toPass()
}

/**
 * Amène le haut du tableau juste sous les barres collées en haut de la fenêtre. La barre de résumé ne s'y colle qu'une
 * fois la page défilée : le tableau est d'abord approché, puis les barres mesurées.
 */
async function placerLeTableauSousLesBarres(page: Page, marge: number) {
  await placerLeTableau(page, 300)
  // Collée, la barre de résumé se réduit : deux passes.
  await placerLeTableau(page, (await mesurer(page)).barres + marge)
  await placerLeTableau(page, (await mesurer(page)).barres + marge)
}

/** Le cadre du tableau et de ses repères, pour un audit qui ne voit pas le reste de la page (en partie sous les barres collées). */
const CADRE_DU_TABLEAU = 'div:has(> [role="region"][aria-label="Tableau de comparaison"])'

test.describe("dans une fenêtre de 700 px", () => {
  test.use({ viewport: { width: 700, height: 620 } })

  test("le tableau du comparateur montre où il défile, et ses flèches y mènent", async ({ page }) => {
    await page.goto(SITUATION)
    await expect(zone(page)).toBeVisible()

    // Au début : des colonnes à droite seulement.
    await expect(ombre(page, "droite")).toHaveCSS("opacity", "1")
    await expect(ombre(page, "gauche")).toHaveCSS("opacity", "0")
    await expect(fleche(page, "droite")).toBeVisible()
    await expect(fleche(page, "gauche")).toBeHidden()

    await fleche(page, "droite").click()
    await expect.poll(() => zone(page).evaluate(element => element.scrollLeft)).toBeGreaterThan(100)
    await expect(fleche(page, "gauche")).toBeVisible()
    await expect(ombre(page, "gauche")).toHaveCSS("opacity", "1")
    // L'ombre de gauche commence après la première colonne, qui reste en place.
    const premiereColonne = (await zone(page).getByRole("columnheader").first().boundingBox())!
    expect(Math.abs((await ombre(page, "gauche").boundingBox())!.x - (premiereColonne.x + premiereColonne.width))).toBeLessThanOrEqual(1)

    // Jusqu'au bout : la flèche de droite disparaît, et le focus n'a pas quitté sa place.
    for (let clic = 0; clic < 6 && (await fleche(page, "droite").isVisible()); clic++) {
      await fleche(page, "droite").click()
      await page.waitForTimeout(450)
    }
    await expect(fleche(page, "droite")).toBeHidden()
    await expect(ombre(page, "droite")).toHaveCSS("opacity", "0")
    expect(await zone(page).evaluate(element => Math.abs(element.scrollLeft + element.clientWidth - element.scrollWidth))).toBeLessThanOrEqual(1)

    await fleche(page, "gauche").click()
    await expect(fleche(page, "droite")).toBeVisible()
    // Rien ne dépasse de la page : pas de défilement horizontal.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(700)
  })

  test("la zone défile aussi au clavier, et les flèches restent hors de l'ordre de tabulation", async ({ page }) => {
    await page.goto(SITUATION)
    await zone(page).focus()
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("ArrowRight")
    await expect.poll(() => zone(page).evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
    await expect(fleche(page, "gauche")).toBeVisible()
    await expect(fleche(page, "droite")).toHaveAttribute("tabindex", "-1")
  })

  for (const zoom of [1, 1.5]) {
    test(`les flèches restent au milieu de ce qui se voit du tableau, à ${zoom * 100} %`, async ({ page }) => {
      await page.addInitScript(z => window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage: "resume", zoom: z })), zoom)
      await page.goto(SITUATION)
      await deplierLeTableauDuComparateur(page)
      await zone(page).evaluate(element => element.scrollTo({ left: 150, behavior: "instant" }))
      await expect(fleche(page, "gauche")).toBeVisible()

      // Déplié, le tableau est plus haut que la fenêtre. Son haut juste sous les barres : les flèches au milieu de ce
      // qui s'en voit, donc au milieu de l'écran sous les barres.
      await placerLeTableauSousLesBarres(page, 20)
      let mesure = await mesurer(page)
      expect(mesure.tableau.bas).toBeGreaterThan(mesure.fenetre)
      for (const cote of ["gauche", "droite"] as const) {
        expect(mesure[cote].haut).toBeGreaterThanOrEqual(mesure.tableau.haut - 1)
        expect(mesure[cote].bas).toBeLessThanOrEqual(mesure.fenetre)
        expect(Math.abs(milieu(mesure[cote]) - milieuVisible(mesure))).toBeLessThanOrEqual(12)
      }

      // Le tableau traverse la fenêtre : les flèches au milieu de l'écran, sous les barres, et elles n'en bougent pas.
      await placerLeTableau(page, -100)
      mesure = await mesurer(page)
      expect(mesure.tableau.haut).toBeLessThan(mesure.barres)
      expect(mesure.tableau.bas).toBeGreaterThan(mesure.fenetre)
      expect(Math.abs(milieu(mesure.droite) - milieuVisible(mesure))).toBeLessThanOrEqual(2)
      expect(Math.abs(milieu(mesure.gauche) - milieu(mesure.droite))).toBeLessThanOrEqual(1)
      const avant = milieu(mesure.droite)
      await page.evaluate(() => window.scrollBy({ top: 60, behavior: "instant" }))
      mesure = await mesurer(page)
      if (mesure.tableau.bas > mesure.fenetre) expect(Math.abs(milieu(mesure.droite) - avant)).toBeLessThanOrEqual(1)

      // Le bas du tableau remonte dans la fenêtre : les flèches le quittent avec son bord, sans en sortir.
      await placerLeTableau(page, mesure.barres + 60 * zoom, "bottom")
      mesure = await mesurer(page)
      for (const cote of ["gauche", "droite"] as const) {
        expect(mesure[cote].bas).toBeLessThanOrEqual(mesure.tableau.bas + 1)
        expect(mesure[cote].haut).toBeGreaterThanOrEqual(mesure.barres - 1)
      }
    })
  }

  test("un tableau qui tient à l'écran garde ses flèches à mi-hauteur", async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 })
    await page.goto(SITUATION)
    await placerLeTableauSousLesBarres(page, 10)
    const mesure = await mesurer(page)
    expect(mesure.tableau.haut).toBeGreaterThanOrEqual(mesure.barres)
    expect(mesure.tableau.bas).toBeLessThanOrEqual(mesure.fenetre)
    expect(Math.abs(milieu(mesure.droite) - milieu(mesure.tableau))).toBeLessThanOrEqual(1)
    // À cheval sur le bord du tableau : la flèche n'en cache presque rien.
    expect(Math.abs((mesure.droite.gauche + mesure.droite.droite) / 2 - mesure.tableau.droite)).toBeLessThanOrEqual(2)
  })

  test("l'ombre est claire en thème sombre, sombre en thème clair, et le tout reste accessible", async ({ page }) => {
    await page.goto(SITUATION)
    await fleche(page, "droite").click()
    await expect(fleche(page, "gauche")).toBeVisible()
    const luminosite = () =>
      ombre(page, "droite").evaluate(element => {
        const [r, g, b] = (getComputedStyle(element).backgroundImage.match(/[\d.]+/g) ?? []).map(Number)
        return (r + g + b) / 3
      })
    // La teinte est donnée en fraction (color(srgb …)) ou sur 255 (rgb …) selon le navigateur : on compare les deux thèmes.
    const enClair = await luminosite()
    await auditer(page, "tableau qui défile, thème clair", CADRE_DU_TABLEAU)
    await page.evaluate(() => {
      document.documentElement.classList.remove("light")
      document.documentElement.classList.add("dark")
    })
    await expect.poll(luminosite).toBeGreaterThan(enClair * 3)
    await auditer(page, "tableau qui défile, thème sombre", CADRE_DU_TABLEAU)
  })

  test("ni ombres ni flèches à l'impression", async ({ page }) => {
    await page.goto(SITUATION)
    await expect(fleche(page, "droite")).toBeVisible()
    await page.emulateMedia({ media: "print" })
    await expect(fleche(page, "droite")).toBeHidden()
    await expect(ombre(page, "droite")).toBeHidden()
  })
})

test("un tableau qui tient dans sa zone n'a ni ombre ni flèche", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 800 })
  await page.goto(SITUATION)
  await expect(zone(page)).toBeVisible()
  await expect(zone(page).locator("xpath=..").locator("[data-ombre]")).toHaveCount(0)
  await expect(zone(page).locator("xpath=..").getByRole("button", { name: /^Voir les colonnes/ })).toHaveCount(0)
})

test.describe("sur une tablette tactile", () => {
  test.use({ viewport: { width: 700, height: 900 }, hasTouch: true, isMobile: true })

  test("les ombres disent que le tableau défile, sans flèches : on le fait glisser du doigt", async ({ page }) => {
    await page.goto(SITUATION)
    await expect(zone(page)).toBeVisible()
    await expect(ombre(page, "droite")).toHaveCSS("opacity", "1")
    await expect(fleche(page, "droite")).toBeHidden()
    await zone(page).evaluate(element => element.scrollTo({ left: 200, behavior: "instant" }))
    await expect(ombre(page, "gauche")).toHaveCSS("opacity", "1")
    await expect(fleche(page, "gauche")).toBeHidden()
  })
})
