// e2e-web/affichage-panneaux.web.ts
// Affichage « Panneaux » de la démo web (proposition C de l'étude d'allègement de l'écran) : le résumé et le détail
// replié de l'affichage « Résumé », plus un panneau par acteur, ouvert depuis la liste des acteurs, la grille ou les
// résultats. Choix, focus, modification à mesure, accessibilité, téléphone, impression et hauteur de la page.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"

type Affichage = "classique" | "resume" | "panneaux"

/** Dépose la préférence d'affichage avant le chargement, comme si elle avait été choisie lors d'une visite précédente. */
async function choisirAvantLeChargement(page: Page, affichage: Affichage) {
  await page.addInitScript(choix => window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage: choix })), affichage)
}

/** Ouvre la démo et attend la simulation d'exemple, le comparateur et la courbe de l'arbitrage. */
async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await expect(page.getByRole("group", { name: /Net du foyer selon la rémunération nette/ })).toBeVisible()
}

async function ouvrirEnPanneaux(page: Page) {
  await choisirAvantLeChargement(page, "panneaux")
  await ouvrir(page)
  await expect(barre(page).getByRole("link", { name: /^Meilleur/ })).toBeVisible()
}

const barre = (page: Page) => page.getByRole("region", { name: "Résumé de l'année" })
const liste = (page: Page) => page.getByRole("list", { name: "Acteurs de la Simulation" })
const panneau = (page: Page, nom: string) => page.getByRole("complementary", { name: nom })
const espaces = (texte: string | null) => (texte ?? "").replace(/\s+/g, " ").trim()
const ATELIER = "Atelier de Camille"

/** Ouvre le panneau de l'atelier depuis la liste des acteurs ; renvoie le bouton qui l'a ouvert. */
async function ouvrirLAtelier(page: Page) {
  const bouton = liste(page).getByRole("button", { name: new RegExp(`^${ATELIER}`) })
  await bouton.click()
  await expect(panneau(page, ATELIER)).toBeVisible()
  // Le panneau glisse en place (sauf si l'on a demandé moins d'animations) : on le mesure une fois arrivé.
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== "running"))
  return bouton
}

test("l'affichage « Panneaux » se choisit dans la barre d'outils et reprend le résumé", async ({ page }) => {
  await ouvrir(page)
  await page.getByRole("combobox", { name: "Affichage : Classique" }).click()
  await page.getByRole("option", { name: "Panneaux" }).click()

  await expect(barre(page)).toBeVisible()
  await expect(liste(page).getByRole("listitem")).toHaveCount(5)
  // Plus de cartes d'acteurs ni de section « Par activité » à l'écran : une ligne par activité, qui ouvre son panneau.
  await expect(page.getByRole("button", { name: "Modifier les autres réglages" })).toHaveCount(0)
  await expect(page.getByRole("list", { name: "Par activité" })).toBeVisible()
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem("simulateur.preferences") ?? "{}").affichage)).toBe("panneaux")
})

test("un acteur s'ouvre depuis la liste ; Échap ferme son panneau et rend le focus à l'acteur", async ({ page }) => {
  await ouvrirEnPanneaux(page)
  const bouton = await ouvrirLAtelier(page)

  await expect(panneau(page, ATELIER).getByRole("heading", { level: 2, name: ATELIER })).toBeFocused()
  await expect(bouton).toHaveAttribute("aria-expanded", "true")
  // Sur ordinateur, le panneau est à droite du contenu, sous la barre de résumé : il ne cache rien.
  const [cadre, bas, contenu] = await Promise.all([panneau(page, ATELIER).boundingBox(), barre(page).evaluate(e => e.getBoundingClientRect().bottom), page.locator("#contenu").boundingBox()])
  expect(cadre!.y).toBeGreaterThanOrEqual(bas)
  expect(cadre!.x).toBeGreaterThanOrEqual(contenu!.x + contenu!.width)

  await page.keyboard.press("Escape")
  await expect(panneau(page, ATELIER)).toHaveCount(0)
  await expect(bouton).toBeFocused()
})

test("un acteur s'ouvre aussi depuis son nom dans la grille et dans les résultats", async ({ page }) => {
  await ouvrirEnPanneaux(page)
  const boutons = page.getByRole("button", { name: /^Conseil SASU.*réglages et résultats/ })
  // Liste des acteurs, grille, puis ligne de l'activité dans les résultats.
  await expect(boutons).toHaveCount(3)
  await boutons.nth(1).click()
  await expect(panneau(page, "Conseil SASU")).toBeVisible()
  await page.getByRole("button", { name: "Fermer le panneau" }).click()
  await expect(boutons.nth(1)).toBeFocused()

  await page.getByRole("list", { name: "Par activité" }).getByRole("button", { name: /^Conseil SASU/ }).click()
  await expect(panneau(page, "Conseil SASU").getByText("Versé avant impôt sur le revenu")).toBeVisible()
})

test("une option changée dans le panneau se lit aussitôt dans le résumé, et s'annule en une fois", async ({ page }) => {
  await ouvrirEnPanneaux(page)
  await ouvrirLAtelier(page)
  const net = espaces(await barre(page).getByRole("link", { name: /^Net du foyer/ }).textContent())

  await panneau(page, ATELIER).getByRole("switch", { name: "Versement libératoire" }).click()
  await expect.poll(async () => espaces(await barre(page).getByRole("link", { name: /^Net du foyer/ }).textContent())).not.toBe(net)
  await expect(panneau(page, ATELIER)).toBeVisible()

  await page.getByRole("button", { name: "Annuler" }).click()
  await expect.poll(async () => espaces(await barre(page).getByRole("link", { name: /^Net du foyer/ }).textContent())).toBe(net)
  await expect(panneau(page, ATELIER).getByRole("switch", { name: "Versement libératoire" })).toBeChecked()
})

test("une saisie dans les autres réglages s'applique en quittant le champ", async ({ page }) => {
  await ouvrirEnPanneaux(page)
  await ouvrirLAtelier(page)
  await panneau(page, ATELIER).getByText("Autres réglages").click()
  const nom = panneau(page, ATELIER).getByLabel("Nom", { exact: true })
  await nom.fill("Atelier de Camille Martin")
  await nom.press("Enter")
  await expect(panneau(page, "Atelier de Camille Martin")).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Activité comparée" })).toHaveText("Atelier de Camille Martin")
})

test("« Comparer ses statuts » mène au comparateur de cette activité, sous la barre de résumé", async ({ page }) => {
  await ouvrirEnPanneaux(page)
  await liste(page).getByRole("button", { name: /^Conseil SASU/ }).click()
  await panneau(page, "Conseil SASU").getByRole("button", { name: "Comparer ses statuts" }).click()

  const titre = page.getByRole("heading", { name: "Comparateur de statuts" })
  await expect(titre).toBeFocused()
  await expect(page.getByRole("combobox", { name: "Activité comparée" })).toHaveText("Conseil SASU")
  const [haut, bas] = await Promise.all([titre.evaluate(e => e.getBoundingClientRect().top), barre(page).evaluate(e => e.getBoundingClientRect().bottom)])
  expect(haut).toBeGreaterThanOrEqual(bas - 1)
})

test("le panneau suit l'acteur quand l'année affichée change", async ({ page }) => {
  await ouvrirEnPanneaux(page)
  await page.getByRole("button", { name: "Ajouter une année" }).click()
  await page.getByRole("radio", { name: /^2025, avant/ }).check()
  await page.getByRole("radio", { name: "Commencer avec une grille vide" }).check()
  await page.getByRole("button", { name: "Ajouter 2025" }).click()
  await ouvrirLAtelier(page)

  // L'année se change dans la barre de résumé ; le panneau reste ouvert, sur les résultats de l'autre année.
  const annees = barre(page).getByRole("combobox", { name: "Année affichée" })
  await expect(annees).toHaveText("2025")
  await expect(panneau(page, ATELIER).getByRole("heading", { name: "Résultats 2025" })).toBeVisible()
  await annees.click()
  await page.getByRole("option", { name: "2026" }).click()
  await expect(annees).toHaveText("2026")
  await expect(panneau(page, ATELIER).getByRole("heading", { name: "Résultats 2026" })).toBeVisible()
})

test("l'affichage « Panneaux » ne présente aucune violation WCAG, panneau fermé puis ouvert, en clair et en sombre", async ({ page }) => {
  await ouvrirEnPanneaux(page)
  await auditer(page, "panneaux, panneau fermé")
  await ouvrirLAtelier(page)
  await panneau(page, ATELIER).getByText("Autres réglages").click()
  await auditer(page, "panneaux, panneau de l'atelier ouvert")
  await page.getByRole("switch", { name: "Changer de thème" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await auditer(page, "panneaux, thème sombre, panneau ouvert")
})

test("au clavier, le panneau s'ouvre, se parcourt et se referme sans piéger le focus", async ({ page }) => {
  await ouvrirEnPanneaux(page)
  const bouton = liste(page).getByRole("button", { name: new RegExp(`^${ATELIER}`) })
  await bouton.focus()
  await page.keyboard.press("Enter")
  await expect(panneau(page, ATELIER).getByRole("heading", { level: 2 })).toBeFocused()
  // Tab parcourt le panneau puis en sort : il n'est pas modal.
  let sorti = false
  for (let i = 0; i < 60 && !sorti; i++) {
    await page.keyboard.press("Tab")
    sorti = await page.evaluate(() => !document.getElementById("panneau-acteur")?.contains(document.activeElement))
  }
  expect(sorti).toBe(true)
  await page.keyboard.press("Shift+Tab")
  await page.keyboard.press("Escape")
  await expect(bouton).toBeFocused()
})

test("à l'impression, pas de panneau : les réglages de chaque acteur et les cartes des activités sont sur le papier", async ({ page }) => {
  await choisirAvantLeChargement(page, "panneaux")
  await page.setViewportSize({ width: 794, height: 1123 })
  await ouvrir(page)
  await ouvrirLAtelier(page)
  const reglages = page.getByText(/ACRE : non · Versement libératoire : oui/)
  const carte = page.getByRole("article").filter({ hasText: "Conseil SASU" })
  await expect(reglages).toBeHidden()
  await expect(carte).toBeHidden()

  await page.emulateMedia({ media: "print" })

  await expect(panneau(page, ATELIER)).toBeHidden()
  await expect(liste(page)).toBeHidden()
  await expect(reglages).toBeVisible()
  await expect(page.getByText(/Parts propres : 1 · .*Relations : .*Président → Conseil SASU/)).toBeVisible()
  await expect(carte).toBeVisible()
  await expect(page.getByRole("list", { name: "Par activité" })).toBeHidden()
})

/** Contrôles visibles du panneau plus petits que le minimum, en px. */
async function ciblesTropPetites(page: Page, minimum: number) {
  return page
    .locator('#panneau-acteur :is(button, input, summary, [role="switch"], [role="combobox"])')
    .evaluateAll((elements, min) =>
      elements.flatMap(element => {
        if (!element.checkVisibility()) return []
        const zone = (element.closest("label") ?? element).getBoundingClientRect()
        return zone.width < min || zone.height < min ? [`${element.getAttribute("aria-label") ?? element.textContent?.trim()} : ${Math.round(zone.width)} × ${Math.round(zone.height)}`] : []
      }),
      minimum
    )
}

test("les contrôles du panneau mesurent au moins 24 px", async ({ page }) => {
  await ouvrirEnPanneaux(page)
  await ouvrirLAtelier(page)
  await panneau(page, ATELIER).getByText("Autres réglages").click()
  expect(await ciblesTropPetites(page, 24)).toEqual([])
})

for (const largeur of [320, 375]) {
  test.describe(`sur un téléphone de ${largeur} px`, () => {
    test.use({ viewport: { width: largeur, height: 812 }, hasTouch: true, isMobile: true })

    test("le panneau se pose en bas de l'écran, sans débordement, et la fin de la page reste atteignable", async ({ page }) => {
      await ouvrirEnPanneaux(page)
      await ouvrirLAtelier(page)
      const cadre = (await panneau(page, ATELIER).boundingBox())!
      expect(cadre.y + cadre.height).toBeCloseTo(812, 0)
      expect(cadre.height).toBeLessThanOrEqual(812 / 2 + 1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur)

      // Le pied de page défile au-dessus du panneau.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      const piedDePage = await page.getByText(/^Avertissement/).evaluate(e => e.getBoundingClientRect().bottom)
      expect(piedDePage).toBeLessThanOrEqual(cadre.y + 1)

      // Agrandi, il laisse voir la barre de résumé.
      await panneau(page, ATELIER).getByRole("button", { name: "Agrandir le panneau" }).click()
      await expect(panneau(page, ATELIER).getByRole("button", { name: "Réduire le panneau" })).toHaveAttribute("aria-expanded", "true")
      expect(await ciblesTropPetites(page, 44)).toEqual([])
    })

    test("un élément qui reçoit le focus n'est pas caché sous le panneau", async ({ page }) => {
      await ouvrirEnPanneaux(page)
      await ouvrirLAtelier(page)
      const cible = page.getByRole("button", { name: /Flux de janvier : Conseil SASU/ })
      await cible.focus()
      const [bas, hautDuPanneau] = await Promise.all([cible.evaluate(e => e.getBoundingClientRect().bottom), panneau(page, ATELIER).evaluate(e => e.getBoundingClientRect().top)])
      expect(bas).toBeLessThanOrEqual(hautDuPanneau)
    })
  })
}

test.describe("sur un téléphone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  test("l'affichage « Panneaux » ne présente aucune violation WCAG à 375 px, panneau ouvert", async ({ page }) => {
    await ouvrirEnPanneaux(page)
    await ouvrirLAtelier(page)
    await auditer(page, "panneaux, 375 px, panneau ouvert")
  })
})

/** Hauteur de la page au chargement, sections repliées, panneau fermé. */
async function hauteur(page: Page, affichage: Affichage) {
  await choisirAvantLeChargement(page, affichage)
  await ouvrir(page)
  return page.evaluate(() => document.documentElement.scrollHeight)
}

// Estimation de l'étude (docs/conception/allegement-ecran.md) : environ 2 800 px sur ordinateur, 4 600 px sur
// téléphone. Le panneau retire la liste détaillée des acteurs et les cartes des activités : la page doit être plus
// courte que celle de l'affichage « Résumé ».
for (const [largeur, hauteurEcran] of [
  [1440, 900],
  [375, 812]
] as const) {
  test.describe(`hauteur de la page à ${largeur} px`, () => {
    test.use({ viewport: { width: largeur, height: hauteurEcran }, hasTouch: largeur < 500, isMobile: largeur < 500 })

    test("l'affichage « Panneaux » est plus court que l'affichage « Résumé »", async ({ page, context }) => {
      const panneaux = await hauteur(page, "panneaux")
      const resume = await hauteur(await context.newPage(), "resume")
      const classique = await hauteur(await context.newPage(), "classique")
      test.info().annotations.push({ type: "hauteur", description: `${largeur} px : classique ${classique} px, résumé ${resume} px, panneaux ${panneaux} px` })
      console.log(`Hauteur à ${largeur} px : classique ${classique} px, résumé ${resume} px, panneaux ${panneaux} px`)
      expect(panneaux).toBeLessThan(resume)
      expect(panneaux).toBeLessThan(classique * 0.6)
    })
  })
}
