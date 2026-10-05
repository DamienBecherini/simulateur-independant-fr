// e2e-web/cibles.web.ts
// Taille des zones cliquables (WCAG 2.2, critère 2.5.8) : au moins 24 × 24 px pour chaque contrôle visible,
// et 44 × 44 px sur écran tactile, où l'interface les agrandit. Mesuré sur la démo web, en largeur de téléphone.

import { test, expect, type Page } from "@playwright/test"

const CONTROLES = 'button, a[href], input, select, textarea, summary, [role="button"], [role="switch"], [role="combobox"], [tabindex="0"]'

interface Cible {
  description: string
  largeur: number
  hauteur: number
}

/** Ouvre la démo, attend la simulation d'exemple et déplie les sections repliables du comparateur. */
async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await expect(page.getByRole("group", { name: /Net du foyer selon la rémunération nette/ })).toBeVisible()
  const sommaires = page.locator("details:not([open]) > summary")
  while ((await sommaires.count()) > 0) await sommaires.first().click()
}

/**
 * Mesure chaque contrôle visible. Sa zone cliquable est celle de l'étiquette <label> qui l'englobe s'il y en a une
 * (un clic sur l'étiquette l'active). Les liens au fil d'un texte relèvent de l'exception « en ligne » du critère.
 */
async function mesurerLesCibles(page: Page): Promise<Cible[]> {
  return page.locator(CONTROLES).evaluateAll(elements =>
    elements.flatMap(element => {
      if (element.closest('[aria-hidden="true"], [inert]') || !element.checkVisibility({ visibilityProperty: true })) return []
      const style = getComputedStyle(element)
      if (element.tagName === "A" && style.display === "inline") return []
      // Masqué hors focus (lien d'évitement en sr-only) : il n'est pas affiché, donc pas cliquable.
      if (style.clip === "rect(0px, 0px, 0px, 0px)" || style.clipPath === "inset(50%)") return []
      const zone = (element.closest("label") ?? element).getBoundingClientRect()
      if (zone.width === 0 && zone.height === 0) return []
      const nom = element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 40) ?? ""
      return [{ description: `<${element.tagName.toLowerCase()}> « ${nom} »`, largeur: Math.round(zone.width * 10) / 10, hauteur: Math.round(zone.height * 10) / 10 }]
    })
  )
}

function tropPetites(cibles: Cible[], minimum: number): string[] {
  return cibles.filter(c => c.largeur < minimum || c.hauteur < minimum).map(c => `${c.description} : ${c.largeur} × ${c.hauteur} px`)
}

/** Ouvre chaque fenêtre, mesure ses contrôles et la referme ; renvoie les cibles trop petites, fenêtre par fenêtre. */
async function ciblesDesFenetres(page: Page, minimum: number): Promise<string[]> {
  const fenetres: [string, () => Promise<void>][] = [
    ["paramètres", () => page.getByRole("button", { name: "Paramètres" }).click()],
    [
      "liste des sauvegardes",
      async () => {
        await page.getByRole("button", { name: "Paramètres" }).click()
        await page.getByRole("button", { name: "Charger une sauvegarde..." }).click()
      }
    ],
    [
      "réglages d'une personne, frais réels dépliés",
      async () => {
        await page.getByRole("button", { name: "Modifier les autres réglages" }).first().click()
        await page.getByRole("switch", { name: "Comparer mes frais réels à la déduction de 10 %" }).click()
      }
    ],
    [
      "réglages d'une activité, déplacements dépliés",
      async () => {
        await page.getByRole("button", { name: "Modifier les autres réglages" }).last().click()
        await page.getByRole("switch", { name: "Déplacements avec une voiture personnelle" }).click()
      }
    ],
    ["choix du type d'activité", () => page.getByRole("button", { name: "+ Ajouter une Activité" }).click()],
    ["flux d'un mois", () => page.getByRole("button", { name: /^Flux de janvier/ }).last().click()],
    ["couleurs des flux", () => page.getByRole("button", { name: "Gérer les couleurs" }).click()]
  ]
  const resultats: string[] = []
  for (const [nom, ouvrirFenetre] of fenetres) {
    await ouvrirFenetre()
    await expect(page.getByRole("dialog")).toBeVisible()
    // Une fenêtre apparaît en grossissant : on la mesure une fois l'animation terminée.
    await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== "running"))
    resultats.push(...tropPetites(await mesurerLesCibles(page), minimum).map(c => `[${nom}] ${c}`))
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden()
  }
  return resultats
}

test.describe("à la souris, sur un écran de 375 px", () => {
  test.use({ viewport: { width: 375, height: 800 } })

  test("chaque contrôle visible mesure au moins 24 × 24 px", async ({ page }) => {
    await ouvrir(page)
    const cibles = await mesurerLesCibles(page)
    expect(cibles.length).toBeGreaterThan(50)
    expect(tropPetites(cibles, 24), "Zones cliquables de moins de 24 × 24 px").toEqual([])
    expect(await ciblesDesFenetres(page, 24), "Zones cliquables de moins de 24 × 24 px dans les fenêtres").toEqual([])
  })
})

test.describe("au doigt, sur un téléphone", () => {
  test.use({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true })

  test("chaque contrôle visible mesure au moins 44 × 44 px", async ({ page }) => {
    await ouvrir(page)
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches), "Le téléphone émulé doit avoir un pointeur grossier").toBe(true)
    expect(tropPetites(await mesurerLesCibles(page), 44), "Zones cliquables de moins de 44 × 44 px au doigt").toEqual([])
    expect(await ciblesDesFenetres(page, 44), "Zones cliquables de moins de 44 × 44 px au doigt dans les fenêtres").toEqual([])
  })
})
