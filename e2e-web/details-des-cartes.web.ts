// e2e-web/details-des-cartes.web.ts
// Détail des cartes de résultats, partagé par groupe : avec beaucoup de foyers et d'activités, un clic ouvre ou ferme
// le détail de tout le groupe, et le bouton cliqué ne bouge pas à l'écran (le lecteur ne perd pas sa place), garde le
// focus, et la page reste accessible. Affichage classique et affichage « Résumé ».

import { test, expect, type Locator, type Page } from "@playwright/test"
import type { Entity, Relationship, SessionState } from "../src/types"
import { grilleMensuelle } from "../e2e/support/sessions"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"

const NOMBRE_DE_PERSONNES = 4
const NOMBRE_D_ACTIVITES = 8

/** Quatre personnes seules (quatre foyers), et huit micro-entreprises, deux par personne, chacune avec son chiffre d'affaires. */
function sessionNombreuse(): SessionState {
  const personnes: Entity[] = Array.from({ length: NOMBRE_DE_PERSONNES }, (_, i) => ({ id: `personne-${i}`, type: "person", name: `Personne ${i + 1}`, fiscalParts: 1, avatar: { type: "initials", value: `P${i + 1}`, color: "#3b82f6" }, locked: false }))
  const activites: Entity[] = Array.from({ length: NOMBRE_D_ACTIVITES }, (_, i) => ({ id: `activite-${i}`, type: "micro-entreprise", name: `Activité ${i + 1}`, beneficieACRE: false, opteVFL: false, avatar: { type: "icon", value: "Store", color: "#f97316" }, locked: false }))
  const relationships: Relationship[] = activites.map((activite, i) => ({ id: `titulaire-${i}`, fromId: `personne-${i % NOMBRE_DE_PERSONNES}`, toId: activite.id, type: "Titulaire" }))
  const flux = activites.flatMap((activite, i) => Array.from({ length: 12 }, (_, mois) => ({ mois, flux: { id: `ca-${i}-${mois}`, entityId: activite.id, type: "ca_micro_services_bnc" as const, label: "Prestations", amount: 1000 + 250 * i } })))
  return { name: "Beaucoup d'activités", entities: [...personnes, ...activites], relationships, annees: [{ annee: 2026, monthlyData: grilleMensuelle(flux) }] }
}

/** Ouvre la démo sur cette session, dans l'affichage voulu. */
async function ouvrir(page: Page, affichage: "classique" | "resume") {
  // Au premier chargement seulement : un rechargement retrouve la session et les préférences enregistrées.
  await page.addInitScript(
    ({ session, affichage }) => {
      if (window.sessionStorage.getItem("session-preparee")) return
      window.sessionStorage.setItem("session-preparee", "oui")
      window.localStorage.setItem("simulateur.session", JSON.stringify({ ...session, formatVersion: 3 }))
      window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage }))
    },
    { session: sessionNombreuse(), affichage }
  )
  await page.goto("./")
  await expect(page.getByRole("article").filter({ hasText: `Activité ${NOMBRE_D_ACTIVITES}` })).toBeVisible()
}

const TOUTES = /le détail \(toutes les cartes\)$/
const boutons = (page: Page) => page.getByRole("button", { name: TOUTES })
/** Le bouton du détail d'une carte, désignée par un texte qu'elle contient. */
const boutonDe = (page: Page, texte: string) => page.getByRole("article").filter({ hasText: texte }).getByRole("button", { name: TOUTES })
const haut = (element: Locator) => element.evaluate(e => e.getBoundingClientRect().top)
const hauteurDeLaPage = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight)

/** Clique le bouton, puis vérifie qu'il est resté à sa place (moins de 2 px), qu'il garde le focus et que toutes les cartes ont suivi. */
async function basculerSansBouger(page: Page, bouton: Locator, ouvert: boolean) {
  const avant = await haut(bouton)
  const hauteurAvant = await hauteurDeLaPage(page)
  await bouton.click()
  await expect(boutons(page).first()).toHaveAttribute("aria-expanded", String(ouvert))
  // Deux images plus tard : la page a fini sa mise en page, rien ne bouge plus.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect(Math.abs((await haut(bouton)) - avant)).toBeLessThan(2)
  await expect(bouton).toBeFocused()
  for (const autre of await boutons(page).all()) await expect(autre).toHaveAttribute("aria-expanded", String(ouvert))
  // La page a bien changé de hauteur : le bouton est resté en place malgré les cartes ouvertes ou fermées au-dessus de lui.
  expect(Math.abs((await hauteurDeLaPage(page)) - hauteurAvant)).toBeGreaterThan(200)
}

for (const affichage of ["classique", "resume"] as const) {
  test.describe(`affichage ${affichage}`, () => {
    const ouvertAuDepart = affichage === "classique"

    test("un clic sur une activité ouvre ou ferme le détail de toutes les cartes, sans déplacer le bouton cliqué", async ({ page }) => {
      await ouvrir(page, affichage)
      await expect(boutons(page)).toHaveCount(NOMBRE_D_ACTIVITES + NOMBRE_DE_PERSONNES)
      for (const bouton of await boutons(page).all()) await expect(bouton).toHaveAttribute("aria-expanded", String(ouvertAuDepart))

      // L'avant-dernière activité, au milieu de la fenêtre : des cartes qui changent de hauteur sont au-dessus d'elle.
      const bouton = boutonDe(page, `Activité ${NOMBRE_D_ACTIVITES - 1}`)
      await bouton.evaluate(e => e.scrollIntoView({ block: "center" }))
      await basculerSansBouger(page, bouton, !ouvertAuDepart)

      // Au clavier, le même bouton rebascule toutes les cartes, toujours sans bouger.
      const avant = await haut(bouton)
      await page.keyboard.press("Enter")
      await expect(bouton).toHaveAttribute("aria-expanded", String(ouvertAuDepart))
      expect(Math.abs((await haut(bouton)) - avant)).toBeLessThan(2)
      for (const autre of await boutons(page).all()) await expect(autre).toHaveAttribute("aria-expanded", String(ouvertAuDepart))
    })

    test("un clic sur un foyer ouvre ou ferme aussi le détail des activités, sans déplacer le bouton cliqué", async ({ page }) => {
      await ouvrir(page, affichage)
      const foyers = page.getByRole("article").filter({ hasText: "Foyer fiscal ·" }).getByRole("button", { name: TOUTES })
      await expect(foyers).toHaveCount(NOMBRE_DE_PERSONNES)
      const bouton = foyers.last()
      await bouton.evaluate(e => e.scrollIntoView({ block: "center" }))
      const avant = await haut(bouton)
      await bouton.click()
      await expect(bouton).toHaveAttribute("aria-expanded", String(!ouvertAuDepart))
      expect(Math.abs((await haut(bouton)) - avant)).toBeLessThan(2)
      await expect(bouton).toBeFocused()
      for (const autre of await boutons(page).all()) await expect(autre).toHaveAttribute("aria-expanded", String(!ouvertAuDepart))
    })

    test("le détail ouvert de toutes les cartes reste accessible", async ({ page }) => {
      await ouvrir(page, affichage)
      if (!ouvertAuDepart) await boutons(page).first().click()
      await expect(page.getByText("Chiffre d'affaires", { exact: true }).first()).toBeVisible()
      await auditer(page, `détail des cartes ouvert, ${affichage}`)
    })
  })
}

test("le détail ouvert ou fermé est retrouvé au rechargement", async ({ page }) => {
  await ouvrir(page, "resume")
  await boutons(page).first().click()
  await expect(boutons(page).last()).toHaveAttribute("aria-expanded", "true")
  // Les préférences sont enregistrées dans le navigateur peu après la bascule.
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem("simulateur.preferences") ?? "{}").sectionsOuvertes)).toEqual({ "details-des-cartes": true })

  await page.reload()
  await expect(boutons(page)).toHaveCount(NOMBRE_D_ACTIVITES + NOMBRE_DE_PERSONNES)
  for (const bouton of await boutons(page).all()) await expect(bouton).toHaveAttribute("aria-expanded", "true")
})
