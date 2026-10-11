// e2e-web/focus-sous-les-barres.web.ts
// La barre d'outils et la barre de résumé sont collées en haut de la fenêtre, et la page réserve leur hauteur
// (`scroll-padding-top`) pour qu'un élément du contenu qui prend le focus ne passe pas dessous. Cette réserve ne doit
// pas s'appliquer aux éléments des barres elles-mêmes : leur donner le focus au clavier ne fait jamais défiler la page.

import { test, expect, type Locator, type Page } from "@playwright/test"

const TAILLES = [
  { nom: "bureau", viewport: { width: 1366, height: 768 } },
  { nom: "téléphone", viewport: { width: 375, height: 667 } }
]

async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await expect(page.getByRole("region", { name: "Résumé de l'année" }).getByRole("link", { name: /^Meilleur/ })).toBeVisible()
}

/** Défile bien au-delà de la barre de résumé, jusqu'au comparateur, et attend qu'elle soit collée. */
async function defiler(page: Page) {
  await page.locator("#comparateur-verdict").scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 200)
  await expect.poll(() => page.evaluate(() => document.querySelector("[data-barre-collante]")!.getBoundingClientRect().top)).toBeLessThan(120)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500)
  // Le défilement peut être animé : on attend qu'il soit arrêté.
  let precedent = -1
  await expect.poll(async () => {
    const actuel = await page.evaluate(() => window.scrollY)
    const stable = actuel === precedent
    precedent = actuel
    return stable
  }).toBe(true)
}

/** Bas des barres collées : la hauteur d'écran qu'elles couvrent. */
const basDesBarres = (page: Page) =>
  page.evaluate(() => {
    const outils = document.querySelector("nav[aria-label=\"Barre d'outils\"]")!.getBoundingClientRect().bottom
    const resume = document.querySelector("[data-barre-visible]")!.getBoundingClientRect().bottom
    return Math.max(outils, resume)
  })

/** Le focus est-il dans l'une des deux barres ? */
const dansUneBarre = (page: Page) =>
  page.evaluate(() => !!document.activeElement?.closest("nav[aria-label=\"Barre d'outils\"], [data-barre-collante]"))

/** Donne le focus sans faire défiler : pose le point de départ du parcours, sans rien changer à la page. */
const focaliser = (el: Element) => (el as HTMLElement).focus({ preventScroll: true })

/**
 * Appuie sur la touche tant que le focus reste dans une barre, en vérifiant que la page n'a pas bougé ; la dernière
 * pression, qui en sort vers le contenu, peut légitimement faire défiler. Rend le nombre d'arrêts dans les barres.
 */
async function parcourir(page: Page, touche: string, depart: number): Promise<number> {
  let arrets = 1
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press(touche)
    if (!(await dansUneBarre(page))) return arrets
    expect(await page.evaluate(() => window.scrollY), `${touche} n° ${i + 1}`).toBe(depart)
    arrets++
  }
  return arrets
}

for (const { nom, viewport } of TAILLES) {
  test.describe(`sur un écran de ${nom} (${viewport.width} px)`, () => {
    test.use({ viewport, ...(nom === "téléphone" ? { hasTouch: true, isMobile: true } : {}) })

    // Le parcours part d'une page défilée, focus posé sans défilement ; sortir d'une barre vers le contenu peut faire
    // défiler la page, d'où une page défilée de nouveau pour chaque parcours.
    const parcours: Array<[string, (page: Page) => Locator, string]> = [
      ["dans la barre de résumé avec Tab", page => page.getByRole("region", { name: "Résumé de l'année" }).getByRole("link").first(), "Tab"],
      ["dans la barre d'outils avec Tab", page => page.getByRole("button", { name: "Paramètres" }), "Tab"],
      ["dans la barre de résumé avec Maj+Tab, depuis le contenu", page => page.getByRole("button", { name: "+ Ajouter une personne" }), "Shift+Tab"]
    ]
    for (const [titre, depart, touche] of parcours) {
      test(`${titre}, la page ne défile pas`, async ({ page }) => {
        await ouvrir(page)
        await defiler(page)
        const y = await page.evaluate(() => window.scrollY)
        await depart(page).evaluate(focaliser)
        expect(await parcourir(page, touche, y), "arrêts dans les barres").toBeGreaterThan(1)
      })
    }

    test("un élément du contenu qui prend le focus apparaît sous les barres", async ({ page }) => {
      await ouvrir(page)
      await defiler(page)
      // On remonte la page au clavier depuis le comparateur : chaque élément atteint doit se voir en entier sous les barres.
      await page.evaluate(() => {
        const visibles = Array.from(document.querySelectorAll<HTMLElement>("main button, main a[href], main input, main [tabindex=\"0\"]"))
          .filter(el => el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().top > 0 && el.getBoundingClientRect().bottom < window.innerHeight)
        visibles.at(-1)!.focus({ preventScroll: true })
      })
      let controles = 0
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press("Shift+Tab")
        if (await dansUneBarre(page)) continue
        const { haut, bas } = await page.evaluate(() => {
          const rect = document.activeElement!.getBoundingClientRect()
          return { haut: rect.top, bas: rect.bottom }
        })
        const barres = await basDesBarres(page)
        if (haut === bas) continue
        expect(haut, "sous les barres collées").toBeGreaterThanOrEqual(barres - 1)
        controles++
      }
      expect(controles).toBeGreaterThan(5)
    })
  })
}
