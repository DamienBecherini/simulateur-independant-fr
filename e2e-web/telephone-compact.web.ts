// e2e-web/telephone-compact.web.ts
// Sur un téléphone (moins de 640 px), la barre d'outils garde ses actions principales et range les autres dans le menu
// « Plus d'actions » : rien ne déborde ni n'est coupé. Une fois la page défilée, la barre de résumé se réduit à une
// ligne, dépliable : les barres collées en haut laissent l'écran au contenu, sans que le contenu saute.

import { test, expect, type Locator, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"

/** Hauteur collée en haut visée sur un téléphone, après défilement (227 px avant, sur 812). */
const SEUIL_COLLANT = 130

const barreDOutils = (page: Page) => page.getByRole("navigation", { name: "Barre d'outils" })
const plusDActions = (page: Page) => barreDOutils(page).getByRole("button", { name: "Plus d'actions" })
const menu = (page: Page) => page.getByRole("menu", { name: "Plus d'actions" })

async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await expect(page.getByRole("region", { name: "Résumé de l'année" }).getByRole("link", { name: /^Meilleur/ })).toBeVisible()
}

/** Les boutons visibles de la barre d'outils qui sortent, même en partie, de la largeur de l'écran. */
const boutonsQuiDebordent = (page: Page) =>
  barreDOutils(page).evaluate(nav =>
    Array.from(nav.querySelectorAll<HTMLElement>("button, [role=switch], [role=combobox]"))
      .filter(el => el.getBoundingClientRect().width > 0)
      .filter(el => el.getBoundingClientRect().left < 0 || el.getBoundingClientRect().right > window.innerWidth)
      .map(el => el.getAttribute("aria-label") ?? el.textContent)
  )

/**
 * Bas des éléments collés en haut de la fenêtre (position fixe, ou collante et arrivée à sa place) : la hauteur
 * d'écran qu'ils couvrent. La barre de résumé réduite garde sa hauteur pleine dans le flux, transparente et sans
 * clic sous sa partie peinte (`data-barre-visible`) : c'est celle-ci qui compte.
 */
const hauteurCollee = (page: Page) =>
  page.evaluate(() =>
    Math.max(
      0,
      ...Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter(el => {
          const style = getComputedStyle(el)
          if (style.position !== "fixed" && style.position !== "sticky") return false
          const rect = el.getBoundingClientRect()
          return rect.height > 0 && rect.top < window.innerHeight / 2 && Math.abs(rect.top - Number.parseFloat(style.top)) < 1
        })
        .map(el => (el.querySelector("[data-barre-visible]") ?? el).getBoundingClientRect().bottom)
    )
  )

/**
 * Touche l'élément du doigt, là où il est affiché. `click()` de Playwright ferait d'abord défiler la page pour le
 * montrer, ce qu'un doigt ne fait pas : on ne mesurerait plus que la page ne bouge pas.
 */
async function toucher(page: Page, element: Locator) {
  const boite = (await element.boundingBox())!
  await page.touchscreen.tap(boite.x + boite.width / 2, boite.y + boite.height / 2)
}

/** Fait défiler jusqu'au comparateur (hors de la grille, dont la bande des mois se colle aussi) et attend la barre réduite. */
async function defilerJusquAuComparateur(page: Page) {
  await page.locator("#comparateur-verdict").scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 200)
  await expect(page.locator("[data-barre-collante]")).toHaveAttribute("data-reduite", "true")
}

for (const largeur of [320, 360, 375, 390, 414, 639]) {
  test.describe(`sur un téléphone de ${largeur} px`, () => {
    test.use({ viewport: { width: largeur, height: 812 }, hasTouch: true, isMobile: true })

    test("la barre d'outils tient dans l'écran, la page ne défile pas en largeur, et les barres collées restent basses", async ({ page }) => {
      await ouvrir(page)
      expect(await boutonsQuiDebordent(page)).toEqual([])
      for (const nom of ["Paramètres", "Annuler", "Rétablir", "Exporter", "Plus d'actions"]) await expect(barreDOutils(page).getByRole("button", { name: nom })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur)

      await defilerJusquAuComparateur(page)
      const hauteur = await hauteurCollee(page)
      test.info().annotations.push({ type: "hauteur collée", description: `${largeur} px : ${Math.round(hauteur)} px` })
      expect(hauteur).toBeLessThanOrEqual(SEUIL_COLLANT)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur)
    })
  })
}

test.describe("sur un téléphone de 375 px", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  test("le menu « Plus d'actions » se parcourt au clavier, se ferme par Échap et change le thème", async ({ page }) => {
    await ouvrir(page)
    for (const nom of ["Donner mon avis", "Montages types"]) await expect(barreDOutils(page).getByRole("button", { name: nom })).toBeHidden()
    await expect(barreDOutils(page).getByRole("switch", { name: "Changer de thème" })).toBeHidden()

    await plusDActions(page).focus()
    await page.keyboard.press("Enter")
    await expect(menu(page)).toBeVisible()
    await expect(plusDActions(page)).toHaveAttribute("aria-expanded", "true")
    await expect(menu(page).getByRole("menuitem", { name: "Montages types" })).toBeFocused()
    await page.keyboard.press("ArrowDown")
    await expect(menu(page).getByRole("menuitem", { name: "Donner mon avis" })).toBeFocused()
    // Le menu tient dans l'écran.
    const boite = (await menu(page).boundingBox())!
    expect(boite.x).toBeGreaterThanOrEqual(0)
    expect(boite.x + boite.width).toBeLessThanOrEqual(375)
    await page.keyboard.press("Escape")
    await expect(menu(page)).toBeHidden()
    await expect(plusDActions(page)).toBeFocused()

    await page.keyboard.press("ArrowUp")
    await expect(menu(page).getByRole("menuitemcheckbox", { name: "Thème sombre" })).toBeFocused()
    const sombreAuDepart = await page.evaluate(() => document.documentElement.classList.contains("dark"))
    await page.keyboard.press("Enter")
    await expect(page.locator("html")).toHaveClass(new RegExp(sombreAuDepart ? "light" : "dark"))
    await expect(plusDActions(page)).toBeFocused()
  })

  test("l'avis, les montages types et l'affichage s'ouvrent depuis le menu ; le focus revient au menu", async ({ page }) => {
    await ouvrir(page)
    await plusDActions(page).click()
    await menu(page).getByRole("menuitem", { name: "Donner mon avis" }).click()
    await expect(page.getByRole("dialog", { name: "Donner mon avis" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(plusDActions(page)).toBeFocused()

    await plusDActions(page).click()
    await menu(page).getByRole("menuitem", { name: "Montages types" }).click()
    await expect(page.getByRole("dialog", { name: "Partir d'un montage type" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(plusDActions(page)).toBeFocused()

    await plusDActions(page).click()
    await menu(page).getByRole("menuitemradio", { name: "Classique" }).click()
    await expect(page.getByRole("region", { name: "Résumé de l'année" })).toBeHidden()
    await plusDActions(page).click()
    await expect(menu(page).getByRole("menuitemradio", { name: "Classique" })).toHaveAttribute("aria-checked", "true")
  })

  test("la barre de résumé se réduit au défilement sans faire sauter la page, et se déplie d'un geste", async ({ page }) => {
    await ouvrir(page)
    const barre = page.locator("[data-barre-collante]")
    const partiePeinte = barre.locator("[data-barre-visible]")
    const hautPleine = (await partiePeinte.boundingBox())!.height
    // Position du contenu dans la page, barre entière : elle ne change pas quand la barre se réduit.
    const positionDuContenu = () => page.evaluate(() => document.getElementById("contenu")!.getBoundingClientRect().top + window.scrollY)
    const avant = await positionDuContenu()
    const defilement = () => page.evaluate(() => Math.round(window.scrollY))

    // Le navigateur ne fait pas non plus défiler la page quand la barre se réduit (il recalerait le contenu si le
    // flux changeait : ancrage du défilement).
    await page.evaluate(() => window.scrollTo(0, 1500))
    await expect(barre).toHaveAttribute("data-reduite", "true")
    await page.waitForTimeout(500)
    expect(await defilement()).toBe(1500)
    expect(await positionDuContenu()).toBeCloseTo(avant, 0)

    await defilerJusquAuComparateur(page)
    expect(await positionDuContenu()).toBeCloseTo(avant, 0)
    expect((await partiePeinte.boundingBox())!.height).toBeLessThan(hautPleine / 2)
    // Sous la partie peinte, la place gardée laisse passer le toucher : le contenu dessous reste atteignable.
    const sousLaBarre = await page.evaluate(() => {
      const bas = document.querySelector("[data-barre-visible]")!.getBoundingClientRect().bottom
      return document.elementFromPoint(window.innerWidth / 2, bas + 20)?.closest("[data-barre-collante]") ?? null
    })
    expect(sousLaBarre).toBeNull()
    const resume = page.getByRole("region", { name: "Résumé de l'année" })
    await expect(resume.getByRole("link", { name: /^Taux/ })).toBeHidden()
    await expect(resume.getByRole("link", { name: /^Alertes/ })).toBeHidden()
    await expect(resume.getByRole("link", { name: /^Net/ })).toBeVisible()
    // Le meilleur statut, coupé à l'écran s'il le faut, garde son libellé entier pour les lecteurs d'écran.
    await expect(resume.getByRole("link", { name: /^Meilleur/ })).toBeVisible()
    await expect(resume.getByRole("link", { name: /^Meilleur/ })).toHaveAccessibleName(/Micro \+ versement libératoire \(actuel\)/)

    const bouton = resume.getByRole("button", { name: /^Taux et alertes/ })
    await expect(bouton).toHaveAttribute("aria-expanded", "false")
    const position = await defilement()
    await toucher(page, bouton)
    await expect(bouton).toHaveAttribute("aria-expanded", "true")
    await expect(resume.getByRole("link", { name: /^Taux/ })).toBeVisible()
    await expect(resume.getByRole("link", { name: /^Alertes/ })).toBeVisible()
    expect(await positionDuContenu()).toBeCloseTo(avant, 0)
    expect(await defilement()).toBe(position)
    await toucher(page, bouton)
    await expect(resume.getByRole("link", { name: /^Taux/ })).toBeHidden()
    expect(await defilement()).toBe(position)

    // De retour en haut, la barre reprend sa place entière.
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(barre).not.toHaveAttribute("data-reduite")
    await expect(resume.getByRole("link", { name: /^Taux/ })).toBeVisible()
  })

  for (const theme of ["clair", "sombre"] as const) {
    test(`le menu et la barre réduite ne présentent aucune violation WCAG, thème ${theme}`, async ({ page }) => {
      await page.addInitScript(choix => window.localStorage.setItem("theme", choix), theme === "sombre" ? "dark" : "light")
      await ouvrir(page)
      await plusDActions(page).click()
      await expect(menu(page)).toBeVisible()
      await auditer(page, `menu « Plus d'actions », thème ${theme}`, "nav")
      await page.keyboard.press("Escape")

      await defilerJusquAuComparateur(page)
      await auditer(page, `barre de résumé réduite, thème ${theme}`, "[data-barre-collante]")
      await page.getByRole("button", { name: /^Taux et alertes/ }).click()
      await auditer(page, `barre de résumé dépliée, thème ${theme}`, "[data-barre-collante]")
    })
  }
})

// Au-delà, la barre de l'ordinateur : elle tient aussi dans les largeurs intermédiaires, à la souris comme au doigt.
for (const doigt of [false, true]) {
  for (const largeur of [640, 768, 800, 1024]) {
    test.describe(`à ${largeur} px, ${doigt ? "au doigt" : "à la souris"}`, () => {
      test.use({ viewport: { width: largeur, height: 800 }, hasTouch: doigt, isMobile: doigt })

      test("aucun bouton de la barre d'outils ne déborde", async ({ page }) => {
        await ouvrir(page)
        await expect(plusDActions(page)).toBeHidden()
        expect(await boutonsQuiDebordent(page)).toEqual([])
      })
    })
  }
}

test("sur un ordinateur, la barre d'outils garde ses boutons et n'a pas de menu « Plus d'actions »", async ({ page }) => {
  await ouvrir(page)
  await expect(plusDActions(page)).toBeHidden()
  for (const nom of ["Donner mon avis", "Montages types"]) await expect(barreDOutils(page).getByRole("button", { name: nom })).toBeVisible()
  await expect(barreDOutils(page).getByRole("switch", { name: "Changer de thème" })).toBeVisible()
  await expect(barreDOutils(page).getByRole("combobox", { name: "Affichage : Résumé" })).toBeVisible()
})
