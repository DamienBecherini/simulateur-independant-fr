// e2e-web/zoom-lisibilite.web.ts
// L'interface agrandie reste lisible. Le zoom (boutons de la barre d'outils) réduit la place réellement disponible : une
// fenêtre de 1 280 px zoomée à 200 % n'offre que 640 px, alors que les points de rupture de la page suivent la largeur de
// la fenêtre. À chaque zoom, dans les trois affichages : aucun texte ni aucune commande hors de l'écran, aucun texte coupé
// par son cadre ou trop petit (support/lisibilite.ts), et chaque fenêtre tient dans l'écran. La barre d'outils, elle,
// suit sa propre largeur : zoomée, elle prend la forme qu'elle aurait dans une fenêtre de cette largeur.
// La session porte ce qui s'affiche de plus long : une activité exonérée en zone (ADR 017), sa note et son avertissement.

import { test, expect, type Locator, type Page } from "@playwright/test"
import { defautsDeLisibilite } from "./support/lisibilite"

const SESSION = {
  formatVersion: 3,
  name: "Atelier en zone franche",
  entities: [
    { id: "person-alice", type: "person", name: "Alice Martin", fiscalParts: 1, avatar: { type: "initials", value: "AM", color: "#3b82f6" }, locked: false },
    { id: "company-atelier", type: "company", name: "Atelier", legalStatus: "SASU", capitalSocial: 1000, dateDeCreation: "2024-01", implantationEnZone: {}, avatar: { type: "icon", value: "Store", color: "#d97706" }, locked: false }
  ],
  relationships: [{ id: "r-president", fromId: "person-alice", toId: "company-atelier", type: "Président" }],
  annees: [{ annee: 2026, monthlyData: Array.from({ length: 12 }, (_, month) => ({ month, flows: month === 0 ? [{ id: "ca", entityId: "company-atelier", type: "ca_services", label: "Prestations", amount: 80000 }] : [] })) }]
}

/** Fenêtres et zooms essayés ; `zoom` est le zoom demandé, que l'application borne selon la largeur (src/lib/zoom.ts). */
const CAS = [
  { largeur: 1280, hauteur: 800, zoom: 1.5, applique: "1.5" },
  { largeur: 1280, hauteur: 800, zoom: 2, applique: "2" },
  { largeur: 1024, hauteur: 700, zoom: 2, applique: "2" },
  { largeur: 800, hauteur: 700, zoom: 2, applique: "1.73" },
  { largeur: 375, hauteur: 700, zoom: 2, applique: "1.17" }
]
const AFFICHAGES = ["resume", "classique", "vues"] as const

async function ouvrir(page: Page, zoom: number, affichage: string) {
  await page.addInitScript(
    ([session, z, a]) => {
      window.localStorage.setItem("simulateur.session", JSON.stringify(session))
      window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage: a, zoom: z }))
    },
    [SESSION, zoom, affichage] as const
  )
  await page.goto("./")
  await expect(page.getByRole("navigation", { name: "Barre d'outils" })).toBeVisible()
}

/** La fenêtre ouverte, une fois son animation d'ouverture finie : elle tient dans l'écran, sans défaut de lisibilité. */
async function verifierLaFenetre(page: Page, fenetre: Locator, taille: { largeur: number; hauteur: number }, nom: string) {
  await expect(fenetre).toBeVisible()
  // Une fenêtre s'ouvre en glissant ou en grandissant : on attend qu'elle ne bouge plus.
  let precedent = ""
  await expect
    .poll(async () => {
      const cadre = JSON.stringify(await fenetre.boundingBox())
      const stable = cadre === precedent
      precedent = cadre
      return stable
    })
    .toBe(true)
  const cadre = (await fenetre.boundingBox())!
  expect(cadre.x, `${nom} : bord gauche`).toBeGreaterThanOrEqual(-1)
  expect(cadre.y, `${nom} : bord haut`).toBeGreaterThanOrEqual(-1)
  expect(cadre.x + cadre.width, `${nom} : bord droit`).toBeLessThanOrEqual(taille.largeur + 1)
  expect(cadre.y + cadre.height, `${nom} : bord bas`).toBeLessThanOrEqual(taille.hauteur + 1)
  expect(await defautsDeLisibilite(page, fenetre), nom).toEqual([])
}

/** Ouvre la fiche « Modifier » de l'acteur de ce nom ; `null` si aucun bouton visible n'y mène dans cet affichage. */
async function ficheDe(page: Page, nom: string) {
  const boutons = page.getByRole("button", { name: "Modifier les autres réglages" })
  const nombre = await boutons.count()
  const fenetre = page.getByRole("dialog", { name: `Modifier : ${nom}` })
  for (let i = 0; i < nombre; i++) {
    if (!(await boutons.nth(i).isVisible())) continue
    await boutons.nth(i).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    if (await fenetre.isVisible()) return fenetre
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden()
  }
  return null
}

const barre = (page: Page) => page.getByRole("navigation", { name: "Barre d'outils" })

for (const cas of CAS) {
  test.describe(`fenêtre de ${cas.largeur} px, zoom demandé de ${cas.zoom * 100} %`, () => {
    test.use({ viewport: { width: cas.largeur, height: cas.hauteur } })

    for (const affichage of AFFICHAGES) {
      test(`affichage « ${affichage} » : la page et ses fenêtres restent lisibles`, async ({ page }) => {
        await ouvrir(page, cas.zoom, affichage)
        await expect.poll(() => page.evaluate(() => document.body.style.zoom)).toBe(cas.applique)
        await expect(page.getByText(/ZFU-TE : bénéfice exonéré d'impôt/).first()).toBeAttached()
        expect(await defautsDeLisibilite(page), "page").toEqual([])

        // Les fenêtres ouvertes depuis la barre d'outils : situations types (dans la barre sur un écran large), export, paramètres.
        const situations = barre(page).getByRole("button", { name: "Situations types" })
        if (await situations.isVisible()) {
          await situations.click()
          await verifierLaFenetre(page, page.getByRole("dialog").first(), cas, "Situations types")
          await page.keyboard.press("Escape")
          await expect(page.getByRole("dialog")).toBeHidden()
        }
        for (const nom of ["Exporter", "Paramètres"]) {
          await barre(page).getByRole("button", { name: nom }).click()
          await verifierLaFenetre(page, page.getByRole("dialog").first(), cas, nom)
          await page.keyboard.press("Escape")
          await expect(page.getByRole("dialog")).toBeHidden()
        }

        // La fiche de l'activité, section « Aides liées au lieu d'implantation » ouverte (case cochée) : la plus longue.
        const fiche = await ficheDe(page, "Atelier")
        if (fiche) {
          await verifierLaFenetre(page, fiche, cas, "fiche de l'activité")
          await expect(fiche.getByRole("button", { name: "Enregistrer" })).toBeInViewport()
        }
      })
    }
  })
}

test.describe("la barre d'outils suit sa largeur réelle, pas celle de la fenêtre", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test("à 100 %, 1 280 px : les noms des boutons, l'affichage et le thème dans la barre", async ({ page }) => {
    await ouvrir(page, 1, "resume")
    await expect(barre(page).getByRole("button", { name: "Donner mon avis" })).toHaveText("Donner mon avis")
    await expect(barre(page).getByRole("button", { name: "Exporter" })).toHaveText("Exporter")
    await expect(barre(page).getByRole("switch", { name: "Changer de thème" })).toBeVisible()
    await expect(barre(page).getByRole("button", { name: "Plus d'actions" })).toBeHidden()
  })

  test("à 200 %, la même fenêtre n'offre que 640 px : icônes seules, comme dans une fenêtre de 640 px", async ({ page }) => {
    await ouvrir(page, 2, "resume")
    await expect.poll(() => page.evaluate(() => document.body.style.zoom)).toBe("2")
    // Les noms s'effacent (le nom accessible reste), et tout tient dans l'écran.
    await expect(barre(page).getByRole("button", { name: "Donner mon avis" }).getByText("Donner mon avis")).toBeHidden()
    await expect(barre(page).getByRole("button", { name: "Exporter" }).getByText("Exporter")).toBeHidden()
    await expect(barre(page).getByRole("button", { name: "Zoom arrière" })).toBeInViewport()
    await expect(barre(page).getByRole("switch", { name: "Changer de thème" })).toBeInViewport()
    expect(await defautsDeLisibilite(page, barre(page))).toEqual([])
    // On peut toujours revenir en arrière : « Zoom arrière » ramène à 190 %.
    await barre(page).getByRole("button", { name: "Zoom arrière" }).click()
    await expect.poll(() => page.evaluate(() => document.body.style.zoom)).toBe("1.9")
  })

  test.describe("fenêtre de 1 024 px", () => {
    test.use({ viewport: { width: 1024, height: 700 } })

    test("à 200 %, 512 px : les actions secondaires passent dans « Plus d'actions », comme sur un téléphone", async ({ page }) => {
      await ouvrir(page, 2, "resume")
      await expect.poll(() => page.evaluate(() => document.body.style.zoom)).toBe("2")
      await expect(barre(page).getByRole("button", { name: "Plus d'actions" })).toBeInViewport()
      await expect(barre(page).getByRole("switch", { name: "Changer de thème" })).toBeHidden()
      await expect(barre(page).getByRole("button", { name: "Situations types" })).toBeHidden()
      // Les boutons de zoom restent : c'est par eux qu'on revient à une taille plus petite.
      await expect(barre(page).getByRole("button", { name: "Zoom arrière" })).toBeInViewport()
      await expect(barre(page).getByRole("button", { name: "Exporter" })).toBeInViewport()
      expect(await defautsDeLisibilite(page, barre(page))).toEqual([])
    })
  })
})
