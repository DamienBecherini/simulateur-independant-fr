// e2e-web/comparateur-notes.web.ts
// Les notes du tableau de comparaison. Dans le tableau, un clic sur la pastille d'une colonne ouvre sa note dans une
// bulle, à côté d'elle, y compris avec l'interface agrandie ; un clic ailleurs ou Échap la ferme, pas le défilement :
// la bulle suit la page, ce qui permet de lire une note plus longue que l'écran. Sous le tableau,
// l'affichage « Résumé » garde écrites les notes du statut actuel et réduit les autres à une ligne de pastilles, avec
// la note choisie ; « Tout afficher » rend la liste complète, et ce choix est retenu. L'impression montre toujours
// toutes les notes.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"
import { deplierLeTableauDuComparateur } from "./support/affichage"

/** La situation type en zone franche : huit notes, dont deux sur la SASU, statut actuel, et celle des conditions typiques du portage. */
const SITUATION = "./#situation=sasu-en-zone-franche-urbaine"
const NOTE_DU_PORTAGE = /Portage salarial : Conditions typiques d'une société de portage/

const tableau = (page: Page) => page.getByRole("table", { name: "Comparaison des statuts" })
const pastilleDuPortage = (page: Page) => tableau(page).getByRole("columnheader", { name: /^Portage salarial/ }).getByRole("button", { name: /^Voir la note/ })
const bulle = (page: Page) => page.getByRole("tooltip")
/** Le bloc des notes sous le tableau : son titre, la ligne de pastilles ou la liste. */
const notes = (page: Page) => page.getByText(/^Notes sur « SASU de Karim »/).locator("xpath=../..")

/** La note choisie dans la ligne de pastilles, ou l'invitation à en choisir une. */
const noteChoisie = (page: Page) => notes(page).locator('[aria-live="polite"]')

/** La bulle est-elle entièrement dans l'écran, et à quelle distance de sa pastille (6 px de l'écran, dessous ou dessus) ? */
/**
 * Où est la bulle : entière dans l'écran, sous les barres collées en haut (barre d'outils, barre de résumé collée),
 * à quelle distance de sa pastille, et si elle est posée sur elle (ramenée dans l'écran faute de place d'un côté
 * comme de l'autre).
 */
async function bullePresDeSaPastille(page: Page): Promise<{ dansLEcran: boolean; sousLesBarres: boolean; ecart: number; surSaPastille: boolean }> {
  return page.evaluate(() => {
    const b = document.querySelector('[role="tooltip"]')!.getBoundingClientRect()
    // La pastille ouverte, dans le contenu : le bouton « Réduire » du bandeau de la démo est lui aussi aria-expanded.
    const p = document.querySelector('main button[aria-expanded="true"]')!.getBoundingClientRect()
    const outils = document.querySelector("nav[aria-label=\"Barre d'outils\"]")?.getBoundingClientRect().bottom ?? 0
    const resume = document.querySelector("[data-barre-collante]")?.getBoundingClientRect()
    const barres = resume && resume.top <= outils + 1 ? Math.max(outils, resume.bottom) : outils
    const dessous = b.top - p.bottom
    const dessus = p.top - b.bottom
    return {
      dansLEcran: b.left >= 0 && b.top >= 0 && b.right <= document.documentElement.clientWidth && b.bottom <= window.innerHeight,
      sousLesBarres: b.top >= barres,
      ecart: Math.round(Math.max(dessous, dessus)),
      surSaPastille: b.top < p.bottom && b.bottom > p.top
    }
  })
}

test("un clic sur une pastille du tableau ouvre sa note dans une bulle ; un clic ailleurs ou Échap la ferme", async ({ page }) => {
  await page.goto(SITUATION)
  await deplierLeTableauDuComparateur(page)
  const pastille = pastilleDuPortage(page)
  await expect(pastille).toHaveAttribute("aria-expanded", "false")
  await expect(bulle(page)).toHaveCount(0)

  await pastille.click()
  await expect(bulle(page)).toBeVisible()
  await expect(bulle(page)).toContainText(NOTE_DU_PORTAGE)
  await expect(pastille).toHaveAttribute("aria-expanded", "true")
  const place = await bullePresDeSaPastille(page)
  expect(place.dansLEcran).toBe(true)
  expect(Math.abs(place.ecart - 6)).toBeLessThanOrEqual(1)
  // La page n'a pas bougé : on lit la note sans quitter le tableau.
  await expect(pastille).toBeInViewport()
  await auditer(page, "comparateur, bulle d'une note ouverte")

  // Clic ailleurs dans la page.
  await tableau(page).getByRole("rowheader", { name: /^Net dans la poche/ }).click()
  await expect(bulle(page)).toHaveCount(0)

  // Au clavier : Entrée ouvre, Échap ferme et laisse le focus sur la pastille.
  await pastille.focus()
  await page.keyboard.press("Enter")
  await expect(bulle(page)).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(bulle(page)).toHaveCount(0)
  await expect(pastille).toBeFocused()

  // Une autre pastille remplace la note affichée ; faire défiler la page ne ferme pas la bulle, qui suit sa pastille.
  await pastille.click()
  await tableau(page).getByRole("columnheader", { name: /^EURL/ }).getByRole("button", { name: /^Voir la note/ }).first().click()
  await expect(bulle(page)).toHaveCount(1)
  await expect(bulle(page)).not.toContainText(NOTE_DU_PORTAGE)
  const avant = await bullePresDeSaPastille(page)
  const hautAvant = await bulle(page).evaluate(element => element.getBoundingClientRect().top)
  await page.mouse.wheel(0, 120)
  await expect.poll(() => bulle(page).evaluate(element => element.getBoundingClientRect().top)).toBeLessThan(hautAvant - 60)
  await expect(bulle(page)).toBeVisible()
  expect((await bullePresDeSaPastille(page)).ecart).toBe(avant.ecart)
})

test("une note plus haute que la place restante s'ouvre quand même sous sa pastille, et se lit en faisant défiler la page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 520 })
  await page.addInitScript(() => window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage: "resume", zoom: 2, sectionsOuvertes: { "comparateur-toutes-les-lignes": true } })))
  await page.goto(SITUATION)
  await expect(tableau(page)).toBeVisible()
  // La note 2 de la SASU, la plus longue : les conditions de l'exonération.
  const pastille = tableau(page).getByRole("columnheader", { name: /^(Meilleur net\s*)?SASU/ }).getByRole("button", { name: "Voir la note 2" })
  await pastille.click()
  await expect(bulle(page)).toContainText(/Exonération ZFU-TE appliquée sans vérifier ses conditions/)
  const bas = () => bulle(page).evaluate(element => Math.round(element.getBoundingClientRect().bottom - window.innerHeight))
  // Elle dépasse le bas de l'écran...
  expect(await bas()).toBeGreaterThan(0)
  // ... et la page défile jusqu'à sa fin, la bulle toujours ouverte.
  await bulle(page).scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 400)
  await expect.poll(bas).toBeLessThanOrEqual(0)
  await expect(bulle(page)).toBeVisible()
  await expect(pastille).toHaveAttribute("aria-expanded", "true")
})

for (const [largeur, zoom] of [
  [1280, 2],
  [1024, 1.5],
  [390, 1]
] as const) {
  test(`fenêtre de ${largeur} px, zoom demandé de ${zoom * 100} % : la bulle reste dans l'écran, hors des barres du haut, près de sa pastille`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 800 })
    await page.addInitScript(z => window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage: "resume", zoom: z, sectionsOuvertes: { "comparateur-toutes-les-lignes": true } })), zoom)
    await page.goto(SITUATION)
    await expect(tableau(page)).toBeVisible()
    const pastilles = tableau(page).getByRole("button", { name: /^Voir la note/ })
    const nombre = await pastilles.count()
    expect(nombre).toBeGreaterThan(5)
    // La première pastille (colonne de gauche) et la dernière (colonne de droite) : les deux bords de l'écran.
    for (const rang of [0, nombre - 1]) {
      await pastilles.nth(rang).scrollIntoViewIfNeeded()
      await pastilles.nth(rang).click()
      await expect(bulle(page)).toBeVisible()
      const place = await bullePresDeSaPastille(page)
      expect(place.dansLEcran, `pastille ${rang}`).toBe(true)
      // Jamais cachée sous la barre de résumé collée en haut (à 200 %, elle s'y ouvrait au-dessus de sa pastille).
      expect(place.sousLesBarres, `pastille ${rang}`).toBe(true)
      // À 6 px de sa pastille, ou posée sur elle quand la place manque d'un côté comme de l'autre.
      if (!place.surSaPastille) expect(Math.abs(place.ecart - 6), `pastille ${rang}`).toBeLessThanOrEqual(1)
      await page.keyboard.press("Escape")
      await expect(bulle(page)).toHaveCount(0)
    }
  })
}

test("affichage « Résumé » : les notes du statut actuel écrites, les autres en une ligne de pastilles, puis « Tout afficher », retenu au rechargement", async ({ page }) => {
  await page.goto(SITUATION)
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  const ligne = notes(page).getByRole("group", { name: "Notes des autres statuts" })
  // Les deux notes de la SASU, statut actuel, restent écrites ; les six autres sont des pastilles.
  const ecrites = notes(page).locator("ol").first()
  await expect(ecrites.getByRole("listitem")).toHaveText([/^1Note 1\. SASU, .*ZFU-TE : bénéfice exonéré/, /^2Note 2\. SASU.* : Exonération ZFU-TE appliquée sans vérifier ses conditions/])
  await expect(ecrites.getByRole("listitem").last()).toBeVisible()
  await expect(ligne.getByRole("button")).toHaveCount(6)
  await expect(noteChoisie(page)).toHaveText("Un clic sur un numéro, ici ou dans le tableau, affiche la note.")

  await ligne.getByRole("button", { name: /^Note 8/ }).click()
  await expect(ligne.getByRole("button", { name: /^Note 8/ })).toHaveAttribute("aria-pressed", "true")
  await expect(noteChoisie(page)).toContainText(NOTE_DU_PORTAGE)
  // Les autres notes restent masquées : la liste complète n'est là que pour l'impression.
  await expect(notes(page).locator("ol").last()).toBeHidden()
  await ligne.getByRole("button", { name: /^Note 3 / }).click()
  await expect(noteChoisie(page)).not.toContainText(NOTE_DU_PORTAGE)
  await expect(noteChoisie(page)).toContainText(/^3Note 3\. /)
  await auditer(page, "comparateur, une note choisie dans la ligne de pastilles")

  await notes(page).getByRole("button", { name: "Tout afficher (8)" }).click()
  await expect(notes(page).getByRole("listitem")).toHaveCount(8)
  await expect(notes(page).getByRole("listitem").last()).toBeVisible()
  await expect(ligne).toHaveCount(0)

  await page.reload()
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await expect(notes(page).getByRole("listitem").last()).toBeVisible()
  await notes(page).getByRole("button", { name: "Réduire les notes des autres statuts" }).click()
  await expect(notes(page).getByRole("group", { name: "Notes des autres statuts" })).toBeVisible()
})

test("à l'impression, toutes les notes sont écrites, même réduites à une ligne de pastilles à l'écran", async ({ page }) => {
  await page.goto(SITUATION)
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await expect(notes(page).getByRole("group", { name: "Notes des autres statuts" })).toBeVisible()
  await page.emulateMedia({ media: "print" })
  // La liste de l'impression, complète ; celle des notes écrites à l'écran lui laisse la place.
  const imprimees = notes(page).locator("ol").last().getByRole("listitem")
  await expect(imprimees).toHaveCount(8)
  await expect(imprimees.first()).toBeVisible()
  await expect(imprimees.last()).toBeVisible()
  await expect(imprimees.last()).toContainText(NOTE_DU_PORTAGE)
  await expect(notes(page).locator("ol").first()).toBeHidden()
  await expect(noteChoisie(page)).toBeHidden()
  await expect(notes(page).getByRole("group", { name: "Notes des autres statuts" })).toBeHidden()
  await expect(notes(page).getByRole("button", { name: /^Tout afficher/ })).toBeHidden()
})
