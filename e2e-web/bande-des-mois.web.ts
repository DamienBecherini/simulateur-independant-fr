// e2e-web/bande-des-mois.web.ts
// Bande des mois au-dessus de la grille mensuelle, qui déborde de l'écran : sur un téléphone de 320 ou 375 px, seuls un
// ou deux mois se voient à côté de la première colonne. La bande montre les mois visibles, mène à un mois d'un toucher
// et suit le défilement ; des flèches avancent d'un mois. Vérifié avec la police du système et une police large.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"
import { choisirAvantLeChargement } from "./support/affichage"
import { choisirLaPolice, POLICES } from "./support/police"

const bande = (page: Page) => page.getByRole("toolbar", { name: "Mois de la grille" })
const mois = (page: Page, nom: string) => bande(page).getByRole("button", { name: new RegExp(`^Aller à ${nom}`) })
const zone = (page: Page) => page.locator(".overflow-x-auto").filter({ has: page.locator("[data-colonne-fixe]") })

async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/).first()).toBeAttached()
  await expect(bande(page)).toBeVisible()
}

/** Écart, en pixels, entre le bord gauche d'un mois de la grille et le bord droit de la première colonne, fixe. */
async function ecartAuBord(page: Page, index: number): Promise<number> {
  const premiere = (await page.locator("[data-colonne-fixe]").boundingBox())!
  const colonne = (await page.locator("[data-mois]").nth(index).boundingBox())!
  return colonne.x - (premiere.x + premiere.width)
}

/** Mois marqués comme visibles par la bande. */
const moisCourants = (page: Page) => bande(page).locator('button[aria-current="true"]').evaluateAll(boutons => boutons.map(b => b.getAttribute("aria-label")?.split(",")[0]))

const largeurDeLaPage = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth)

const BANDE = '[role="toolbar"][aria-label="Mois de la grille"]'

/**
 * Audite la page, puis la bande seule sans la règle de taille des cibles : ses mois, plus étroits que 24 px sur un
 * téléphone, relèvent de l'exception « équivalent » du critère 2.5.8 (les flèches, auditées, mènent à chacun d'eux),
 * qu'axe ne sait pas reconnaître. La page est remise en haut : un contrôle à moitié caché sous la barre de résumé,
 * collée en haut de l'écran, serait compté comme une cible trop petite.
 */
async function auditerAvecLaBande(page: Page, etat: string) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await auditer(page, etat, undefined, { exclure: [BANDE] })
  await auditer(page, `${etat}, bande seule`, BANDE, { sansLesRegles: ["target-size"] })
}

for (const largeur of [320, 375]) {
  test.describe(`sur un téléphone tactile de ${largeur} px`, () => {
    test.use({ viewport: { width: largeur, height: 740 }, hasTouch: true, isMobile: true })

    for (const police of POLICES) {
      test(`la bande mène à juillet, suit le défilement et tient dans l'écran, ${police}`, async ({ page, context }) => {
        await choisirLaPolice(context, police)
        await ouvrir(page)
        // 44 px de haut au doigt, flèches comprises.
        expect((await bande(page).boundingBox())!.height).toBeGreaterThanOrEqual(44)
        for (const fleche of ["Mois précédent", "Mois suivant"]) {
          const boite = (await page.getByRole("button", { name: fleche }).boundingBox())!
          expect(Math.min(boite.width, boite.height)).toBeGreaterThanOrEqual(44)
        }
        await expect(page.getByRole("button", { name: "Mois précédent" })).toBeDisabled()

        // Un toucher sur juillet l'amène juste après la première colonne.
        await mois(page, "juillet").tap()
        await expect.poll(() => ecartAuBord(page, 6)).toBeLessThanOrEqual(1)
        expect(await ecartAuBord(page, 6)).toBeGreaterThanOrEqual(-1)
        await expect(mois(page, "juillet")).toHaveAttribute("aria-current", "true")
        await expect(page.getByRole("button", { name: "Mois précédent" })).toBeEnabled()

        // Défilement à la main, jusqu'à octobre : la bande suit.
        await zone(page).evaluate(element => {
          const octobre = element.querySelectorAll<HTMLElement>("[data-mois]")[9]
          element.scrollLeft = octobre.offsetLeft - element.querySelector<HTMLElement>("[data-colonne-fixe]")!.offsetWidth
        })
        await expect.poll(() => moisCourants(page)).toEqual(["Aller à octobre"])

        // Flèches : un mois en arrière, puis jusqu'au bout de la grille.
        await page.getByRole("button", { name: "Mois précédent" }).tap()
        await expect.poll(() => moisCourants(page)).toEqual(["Aller à septembre"])
        const suivant = page.getByRole("button", { name: "Mois suivant" })
        for (let i = 0; i < 4 && (await suivant.getAttribute("aria-disabled")) !== "true"; i++) {
          await suivant.tap()
          await page.waitForTimeout(400)
        }
        await expect(suivant).toBeDisabled()
        await expect(mois(page, "décembre")).toHaveAttribute("aria-current", "true")

        // La page elle-même ne défile pas en largeur.
        expect(await largeurDeLaPage(page)).toBeLessThanOrEqual(largeur)
      })
    }

    test("la bande et la grille ne présentent aucune violation WCAG, en thème clair et sombre", async ({ page }) => {
      for (const theme of ["light", "dark"] as const) {
        // Le thème choisi est retenu d'une visite à l'autre : on le dépose avant le chargement.
        await page.addInitScript(choix => window.localStorage.setItem("theme", choix), theme)
        await ouvrir(page)
        await expect(page.locator("html")).toHaveClass(new RegExp(theme))
        await auditerAvecLaBande(page, `bande des mois, ${largeur} px, ${theme}`)
        await mois(page, "juillet").tap()
        await expect(mois(page, "juillet")).toHaveAttribute("aria-current", "true")
        await auditerAvecLaBande(page, `bande des mois sur juillet, ${largeur} px, ${theme}`)
      }
    })
  })
}

test.describe("sur un téléphone tactile de 375 px, dans les autres affichages et sur plusieurs années", () => {
  test.use({ viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true })

  for (const affichage of ["classique", "vues"] as const) {
    test(`la bande mène à juillet dans l'affichage « ${affichage} »`, async ({ page }) => {
      await choisirAvantLeChargement(page, affichage)
      await ouvrir(page)
      await mois(page, "juillet").tap()
      await expect.poll(() => ecartAuBord(page, 6)).toBeLessThanOrEqual(1)
      await expect(mois(page, "juillet")).toHaveAttribute("aria-current", "true")
    })
  }

  test("en changeant d'année, la bande garde le mois affiché et suit les flux de l'année", async ({ page }) => {
    await ouvrir(page)
    // L'exemple a des flux en juillet ; la nouvelle année, vide, n'en a aucun.
    await expect(mois(page, "juillet")).toHaveAccessibleName(/^Aller à juillet, \d+ flux$/)
    await mois(page, "juillet").tap()
    await expect(mois(page, "juillet")).toHaveAttribute("aria-current", "true")
    await page.getByRole("button", { name: "Ajouter une année" }).click()
    await page.getByRole("radio", { name: /^2027, après/ }).check()
    await page.getByRole("radio", { name: "Commencer avec une grille vide" }).check()
    await page.getByRole("button", { name: "Ajouter 2027" }).click()
    await expect(page.getByText(/année 2027 avec les règles fiscales/).first()).toBeAttached()
    await expect(mois(page, "juillet")).toHaveAccessibleName("Aller à juillet")
    await expect(bande(page).locator("[data-point]")).toHaveCount(0)
    await expect(mois(page, "juillet")).toHaveAttribute("aria-current", "true")
  })
})

test.describe("sur un grand écran de 1440 px", () => {
  test("la grille déborde encore : la bande montre les mois en abrégé, chacun assez grand pour la souris", async ({ page }) => {
    await ouvrir(page)
    await expect(bande(page).getByRole("button")).toHaveCount(12)
    await expect(mois(page, "février")).toHaveText("Févr", { useInnerText: true })
    for (const bouton of await bande(page).getByRole("button").all()) {
      const boite = (await bouton.boundingBox())!
      expect(Math.min(boite.width, boite.height)).toBeGreaterThanOrEqual(24)
    }
    // Au début, les premiers mois se voient déjà.
    expect((await moisCourants(page)).length).toBeGreaterThan(3)
    await page.getByRole("button", { name: "Mois suivant" }).click()
    await expect.poll(() => ecartAuBord(page, 0)).toBeLessThanOrEqual(1)
  })

  test("la bande, les flèches et les fondus ne sont pas imprimés", async ({ page }) => {
    await ouvrir(page)
    await page.emulateMedia({ media: "print" })
    await expect(bande(page)).toBeHidden()
    await expect(page.getByRole("button", { name: "Mois suivant" })).toBeHidden()
    await expect(page.locator("[data-fondu]").first()).toBeHidden()
  })
})
