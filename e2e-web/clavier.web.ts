// e2e-web/clavier.web.ts
// Navigation au clavier dans la démo web : tout se parcourt avec Tab dans l'ordre de la page, chaque élément
// atteint montre où est le focus, et les entités se réordonnent sans souris.

import { test, expect, type Page } from "@playwright/test"
import { choisirAvantLeChargement } from "./support/affichage"

/** Ouvre la démo dans l'affichage classique, où tout est affiché ; l'affichage « Résumé » a son propre parcours au clavier. */
async function ouvrir(page: Page) {
  await choisirAvantLeChargement(page, "classique")
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await expect(page.getByRole("group", { name: /Net du foyer selon la rémunération nette/ })).toBeVisible()
}

interface Arret {
  nom: string
  indicateur: boolean
}

/** Élément qui a le focus : son nom, et s'il porte un indicateur visible (contour ou anneau en box-shadow). */
function elementActif(page: Page): Promise<Arret | null> {
  return page.evaluate(() => {
    const element = document.activeElement
    if (!element || element === document.body) return null
    const style = getComputedStyle(element)
    const contour = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0 && !/rgba\(.*, 0\)$/.test(style.outlineColor)
    const anneau = style.boxShadow !== "none"
    const nom = element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 50) ?? ""
    return { nom: `<${element.tagName.toLowerCase()}> « ${nom} »`, indicateur: contour || anneau }
  })
}

test("Tab parcourt toute la page dans l'ordre, avec un focus visible sur chaque élément", async ({ page }) => {
  await ouvrir(page)

  // Premier arrêt : le lien d'évitement, qui mène au contenu.
  await page.keyboard.press("Tab")
  const evitement = page.getByRole("link", { name: "Aller au contenu" })
  await expect(evitement).toBeFocused()
  await expect(evitement).toBeInViewport()

  const arrets: Arret[] = []
  for (let i = 0; i < 400; i++) {
    await page.keyboard.press("Tab")
    const arret = await elementActif(page)
    if (!arret || arret.nom.includes("Aller au contenu")) break
    arrets.push(arret)
  }

  expect(arrets.length).toBeGreaterThan(80)
  expect(
    arrets.filter(a => !a.indicateur).map(a => a.nom),
    "Éléments sans indicateur de focus visible"
  ).toEqual([])

  // Ordre de la page : barre d'outils, entités, grille, légende, résultats, comparateur, courbe.
  const position = (motif: RegExp) => arrets.findIndex(a => motif.test(a.nom))
  const reperes = [/« Paramètres »/, /« \+ Ajouter une Personne »/, /« Déplacer « /, /« Flux de janvier/, /« Gérer les couleurs »/, /^<button> « Atelier de Camille »$/, /« Frais de fonctionnement/, /« Net du foyer selon la rémunération nette/, /« Valeurs de la courbe/]
  const positions = reperes.map(position)
  expect(positions.every(p => p >= 0), `Repères introuvables : ${reperes.filter((_, i) => positions[i] < 0).join(", ")}`).toBe(true)
  expect(positions).toEqual([...positions].sort((a, b) => a - b))
})

test("le lien d'évitement mène au contenu", async ({ page }) => {
  await ouvrir(page)
  await page.keyboard.press("Tab")
  await page.keyboard.press("Enter")
  await expect(page.locator("main")).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(page.getByRole("button", { name: "+ Ajouter une Personne" })).toBeFocused()
})

test("une entité se déplace au clavier avec sa poignée : Espace, flèche, Espace", async ({ page }) => {
  await ouvrir(page)
  const noms = page.getByRole("textbox", { name: "Nom" })
  const [premier, second] = [await noms.nth(0).inputValue(), await noms.nth(1).inputValue()]

  const poignee = page.getByRole("button", { name: `Déplacer « ${premier} »` })
  await poignee.focus()
  await page.keyboard.press("Space")
  await expect(poignee).toHaveAttribute("aria-pressed", "true")
  // Les annonces pour les lecteurs d'écran sont en français ; celle-ci signale que la liste est mesurée.
  await expect(page.getByText(`« ${premier} » déplacé en position 1 sur`)).toBeAttached()
  // dnd-kit n'écoute les flèches qu'au tour suivant de la boucle d'événements : sous charge, la première peut
  // arriver trop tôt. On la répète tant que le déplacement n'est pas annoncé.
  await expect(async () => {
    await page.keyboard.press("ArrowDown")
    await expect(page.getByText(`« ${premier} » déplacé en position 2 sur`)).toBeAttached({ timeout: 1000 })
  }).toPass()
  await page.keyboard.press("Space")

  await expect(noms.nth(0)).toHaveValue(second)
  await expect(noms.nth(1)).toHaveValue(premier)
  // Le dépôt est annoncé lui aussi.
  await expect(page.getByText(`« ${premier} » déposé en position 2 sur`)).toBeAttached()
})
