// e2e-web/defilement-des-tableaux.web.ts
// Un tableau plus large que sa zone dit qu'il défile : une ombre du côté où des colonnes sont cachées, et une flèche
// qui y mène. Les flèches sont attachées au tableau, à mi-hauteur ; elles ne s'en détachent que pour rester à l'écran,
// à 30 % du haut ou du bas de ce qui se voit, et jamais près du haut ou du bas du tableau. Un écran tactile n'en a pas
// (on y fait glisser le tableau), l'impression non plus.

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

const borner = (valeur: number, minimum: number, maximum: number) => Math.min(Math.max(valeur, minimum), maximum)

/**
 * Où doit être le milieu d'une flèche, en pixels d'écran : à mi-hauteur du tableau ; ramené entre 30 % du haut et
 * 30 % du bas de ce qui se voit sous les barres (sans jamais bouger les flèches d'un tableau entièrement visible) ;
 * et dans tous les cas à 4 rem au moins du haut et du bas du tableau (le quart de sa hauteur s'il est petit).
 */
function milieuAttendu({ tableau, barres, fenetre }: { tableau: Cadre; barres: number; fenetre: number }, zoom: number): number {
  const fleche = 32 * zoom
  const hauteur = tableau.bas - tableau.haut
  const retenue = Math.max(0, Math.min((fenetre - barres) * 0.3, (hauteur - fleche) / 2))
  const marge = Math.min(64 * zoom, hauteur / 4)
  const aLEcran = borner((tableau.haut + tableau.bas) / 2, barres + retenue + fleche / 2, fenetre - retenue - fleche / 2)
  return borner(aLEcran, tableau.haut + marge + fleche / 2, tableau.bas - marge - fleche / 2)
}

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
    // Chaque clic attend la fin du défilement doux du précédent (plus lent dans Firefox) : arrivée au bout, la flèche
    // disparaît, et un clic lancé pendant le défilement la manquerait.
    const defilementArrete = async () => {
      let precedent = -1
      await expect
        .poll(
          async () => {
            const position = await zone(page).evaluate(element => element.scrollLeft)
            const arrete = position === precedent
            precedent = position
            return arrete
          },
          { intervals: [150] }
        )
        .toBe(true)
    }
    await defilementArrete()
    for (let clic = 0; clic < 6 && (await fleche(page, "droite").isVisible()); clic++) {
      await fleche(page, "droite").click()
      await defilementArrete()
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
    test(`les flèches suivent le tableau et ne s'en détachent que pour rester à l'écran, loin de ses bords, à ${zoom * 100} %`, async ({ page }) => {
      await page.addInitScript(z => window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage: "resume", zoom: z })), zoom)
      await page.goto(SITUATION)
      await deplierLeTableauDuComparateur(page)
      await zone(page).evaluate(element => element.scrollTo({ left: 150, behavior: "instant" }))
      await expect(fleche(page, "gauche")).toBeVisible()

      // Déplié, le tableau est plus haut que la fenêtre. On le fait traverser l'écran, de son entrée par le bas à sa
      // sortie par le haut, et l'on relève à chaque pas où sont les flèches.
      await placerLeTableau(page, 560)
      expect((await mesurer(page)).tableau.bas).toBeGreaterThan(620)
      const releves: { attachee: boolean; dansLeTableau: number }[] = []
      for (let pas = 0; pas < 40; pas++) {
        const mesure = await mesurer(page)
        if (mesure.tableau.bas < mesure.barres) break
        const attendu = milieuAttendu(mesure, zoom)
        for (const cote of ["gauche", "droite"] as const) expect(Math.abs(milieu(mesure[cote]) - attendu), `pas ${pas}, flèche de ${cote}, tableau de ${mesure.tableau.haut} à ${mesure.tableau.bas}`).toBeLessThanOrEqual(2)
        // Jamais près du haut ni du bas du tableau.
        const marge = Math.min(64 * zoom, (mesure.tableau.bas - mesure.tableau.haut) / 4)
        expect(mesure.droite.haut).toBeGreaterThanOrEqual(mesure.tableau.haut + marge - 1)
        expect(mesure.droite.bas).toBeLessThanOrEqual(mesure.tableau.bas - marge + 1)
        releves.push({ attachee: Math.abs(milieu(mesure.droite) - (mesure.tableau.haut + mesure.tableau.bas) / 2) <= 2, dansLeTableau: Math.round(milieu(mesure.droite) - mesure.tableau.haut) })
        await page.evaluate(() => window.scrollBy({ top: 50, behavior: "instant" }))
      }
      // En chemin, les flèches ont été à mi-hauteur du tableau (attachées à lui), et retenues ailleurs à d'autres moments.
      expect(releves.some(releve => releve.attachee)).toBe(true)
      expect(new Set(releves.map(releve => releve.dansLeTableau)).size).toBeGreaterThan(3)
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

    // Tant qu'il se voit en entier, où qu'il soit à l'écran, ses flèches n'en bougent pas.
    await placerLeTableau(page, mesure.fenetre - 5, "bottom")
    const enBas = await mesurer(page)
    expect(enBas.tableau.haut).toBeGreaterThanOrEqual(enBas.barres)
    expect(Math.abs(milieu(enBas.droite) - milieu(enBas.tableau))).toBeLessThanOrEqual(1)
  })

  test("les flèches sont discrètes au repos, et pleinement visibles quand le pointeur est sur le tableau", async ({ page }) => {
    await page.goto(SITUATION)
    await page.mouse.move(5, 300)
    await expect(fleche(page, "droite")).toHaveCSS("opacity", "0.6")
    await zone(page).getByRole("columnheader").first().hover()
    await expect(fleche(page, "droite")).toHaveCSS("opacity", "1")
  })

  test("l'ombre est sombre dans les deux thèmes, et le tout reste accessible", async ({ page }) => {
    await page.goto(SITUATION)
    await fleche(page, "droite").click()
    await expect(fleche(page, "gauche")).toBeVisible()
    /** La teinte de départ du dégradé, lue telle que le navigateur la peint : rouge, vert, bleu et opacité, sur 255. */
    const teinte = () =>
      ombre(page, "droite").evaluate(element => {
        const couleur = getComputedStyle(element).backgroundImage.match(/(?:rgba?|oklab|oklch|color|color-mix)\((?:[^()]|\([^()]*\))*\)/)?.[0] ?? ""
        const toile = document.createElement("canvas")
        toile.width = toile.height = 1
        const dessin = toile.getContext("2d")!
        dessin.fillStyle = couleur
        dessin.fillRect(0, 0, 1, 1)
        const [rouge, vert, bleu, opacite] = dessin.getImageData(0, 0, 1, 1).data
        return { clarte: (rouge + vert + bleu) / 3, opacite }
      })
    const enClair = await teinte()
    expect(enClair.clarte).toBeLessThan(60)
    expect(enClair.opacite).toBeGreaterThan(30)
    await auditer(page, "tableau qui défile, thème clair", CADRE_DU_TABLEAU)
    await page.evaluate(() => {
      document.documentElement.classList.remove("light")
      document.documentElement.classList.add("dark")
    })
    // Sur un fond sombre, l'ombre est plus dense pour se voir.
    await expect.poll(async () => (await teinte()).opacite).toBeGreaterThan(150)
    expect((await teinte()).clarte).toBeLessThan(60)
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
