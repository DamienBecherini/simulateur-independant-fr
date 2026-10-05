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

const ACTIVITES = /le détail \(toutes les activités\)$/
const FOYERS = /le détail \(tous les foyers\)$/
const boutons = (page: Page, groupe: RegExp) => page.getByRole("button", { name: groupe })
const haut = (element: Locator) => element.evaluate(e => e.getBoundingClientRect().top)
const hauteurDeLaPage = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight)

/** Clique le bouton, puis vérifie qu'il est resté à sa place (moins de 2 px), qu'il garde le focus et que tout le groupe a suivi. */
async function basculerSansBouger(page: Page, bouton: Locator, groupe: RegExp, ouvert: boolean) {
  const avant = await haut(bouton)
  const hauteurAvant = await hauteurDeLaPage(page)
  await bouton.click()
  await expect(boutons(page, groupe).first()).toHaveAttribute("aria-expanded", String(ouvert))
  // Deux images plus tard : la page a fini sa mise en page, rien ne bouge plus.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect(Math.abs((await haut(bouton)) - avant)).toBeLessThan(2)
  await expect(bouton).toBeFocused()
  for (const autre of await boutons(page, groupe).all()) await expect(autre).toHaveAttribute("aria-expanded", String(ouvert))
  // La page a bien changé de hauteur : le bouton est resté en place malgré les cartes ouvertes ou fermées au-dessus de lui.
  expect(Math.abs((await hauteurDeLaPage(page)) - hauteurAvant)).toBeGreaterThan(200)
}

for (const affichage of ["classique", "resume"] as const) {
  test.describe(`affichage ${affichage}`, () => {
    const ouvertAuDepart = affichage === "classique"

    test("un clic ouvre ou ferme le détail de toutes les activités, sans déplacer le bouton cliqué", async ({ page }) => {
      await ouvrir(page, affichage)
      await expect(boutons(page, ACTIVITES)).toHaveCount(NOMBRE_D_ACTIVITES)
      for (const bouton of await boutons(page, ACTIVITES).all()) await expect(bouton).toHaveAttribute("aria-expanded", String(ouvertAuDepart))

      // L'avant-dernière activité, au milieu de la fenêtre : des cartes qui changent de hauteur sont au-dessus d'elle.
      const bouton = boutons(page, ACTIVITES).nth(NOMBRE_D_ACTIVITES - 2)
      await bouton.evaluate(e => e.scrollIntoView({ block: "center" }))
      await basculerSansBouger(page, bouton, ACTIVITES, !ouvertAuDepart)
      // Les foyers ne suivent pas.
      for (const foyer of await boutons(page, FOYERS).all()) await expect(foyer).toHaveAttribute("aria-expanded", String(ouvertAuDepart))

      // Au clavier, le même bouton rebascule tout le groupe, toujours sans bouger.
      const avant = await haut(bouton)
      await page.keyboard.press("Enter")
      await expect(bouton).toHaveAttribute("aria-expanded", String(ouvertAuDepart))
      expect(Math.abs((await haut(bouton)) - avant)).toBeLessThan(2)
    })

    test("un clic ouvre ou ferme le détail de tous les foyers, sans déplacer le bouton cliqué", async ({ page }) => {
      await ouvrir(page, affichage)
      await expect(boutons(page, FOYERS)).toHaveCount(NOMBRE_DE_PERSONNES)
      const bouton = boutons(page, FOYERS).last()
      await bouton.evaluate(e => e.scrollIntoView({ block: "center" }))
      const avant = await haut(bouton)
      await bouton.click()
      await expect(bouton).toHaveAttribute("aria-expanded", String(!ouvertAuDepart))
      expect(Math.abs((await haut(bouton)) - avant)).toBeLessThan(2)
      await expect(bouton).toBeFocused()
      for (const autre of await boutons(page, FOYERS).all()) await expect(autre).toHaveAttribute("aria-expanded", String(!ouvertAuDepart))
    })

    test("le détail ouvert de tous les groupes reste accessible", async ({ page }) => {
      await ouvrir(page, affichage)
      if (!ouvertAuDepart) {
        await boutons(page, ACTIVITES).first().click()
        await boutons(page, FOYERS).first().click()
      }
      await expect(page.getByText("Chiffre d'affaires", { exact: true }).first()).toBeVisible()
      await auditer(page, `détail des cartes ouvert, ${affichage}`)
    })
  })
}

test("le détail ouvert ou fermé de chaque groupe est retrouvé au rechargement", async ({ page }) => {
  await ouvrir(page, "resume")
  await boutons(page, ACTIVITES).first().click()
  await expect(boutons(page, ACTIVITES).last()).toHaveAttribute("aria-expanded", "true")
  // Les préférences sont enregistrées dans le navigateur peu après la bascule.
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem("simulateur.preferences") ?? "{}").sectionsOuvertes)).toEqual({ "details-activites": true })

  await page.reload()
  await expect(boutons(page, ACTIVITES)).toHaveCount(NOMBRE_D_ACTIVITES)
  for (const bouton of await boutons(page, ACTIVITES).all()) await expect(bouton).toHaveAttribute("aria-expanded", "true")
  for (const bouton of await boutons(page, FOYERS).all()) await expect(bouton).toHaveAttribute("aria-expanded", "false")
})

test("sans animation demandée, la page ne défile pas en douceur pour compenser", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await ouvrir(page, "resume")
  const bouton = boutons(page, ACTIVITES).nth(NOMBRE_D_ACTIVITES - 1)
  await bouton.evaluate(e => e.scrollIntoView({ block: "center" }))
  const avant = await haut(bouton)
  await bouton.click()
  // Mesuré tout de suite après le clic, sans attendre : la compensation est immédiate.
  expect(Math.abs((await haut(bouton)) - avant)).toBeLessThan(2)
})
