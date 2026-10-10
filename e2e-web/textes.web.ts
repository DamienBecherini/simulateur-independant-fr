// e2e-web/textes.web.ts
// Taille des textes de la démo web : aucun texte affiché sous 12 px, et les paragraphes de texte courant
// (explications, avertissements) à 14 px au moins. Mesuré au zoom de l'interface par défaut (1).

import { test, expect, type Page } from "@playwright/test"

/** Ouvre la démo, attend la simulation d'exemple et déplie les sections repliables du comparateur. */
async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await expect(page.getByRole("group", { name: /Net du foyer selon la rémunération nette/ })).toBeVisible()
  // Seules les sections visibles : le détail des frais d'une colonne est dans le tableau, masqué sur téléphone.
  const sommaires = page.locator("details:not([open]) > summary:visible")
  while ((await sommaires.count()) > 0) await sommaires.first().click()
  // La courbe parcourue au clavier affiche aussi son info-bulle.
  await page.getByRole("group", { name: /Net du foyer selon la rémunération nette/ }).focus()
  await page.keyboard.press("ArrowRight")
}

interface Texte {
  texte: string
  taille: number
  balise: string
  longueur: number
}

/**
 * Taille effective de chaque texte affiché : taille calculée de son élément, multipliée par le zoom appliqué au
 * <body> par les boutons de zoom. Les textes réservés aux lecteurs d'écran (sr-only, 1 px) sont ignorés.
 */
async function mesurerLesTextes(page: Page): Promise<Texte[]> {
  return page.evaluate(() => {
    const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1
    const parcours = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const textes: Texte[] = []
    for (let noeud = parcours.nextNode(); noeud; noeud = parcours.nextNode()) {
      const texte = noeud.textContent?.trim()
      const element = noeud.parentElement
      if (!texte || !element || !element.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue
      const cadre = element.getBoundingClientRect()
      if (cadre.width <= 1 || cadre.height <= 1) continue
      const bloc = element.closest("p, li, dd, dt, td, th, label, button, h1, h2, h3, h4, text") ?? element
      textes.push({ texte: texte.slice(0, 60), taille: parseFloat(getComputedStyle(element).fontSize) * zoom, balise: bloc.tagName.toLowerCase(), longueur: (bloc.textContent ?? "").trim().length })
    }
    return textes
  })
}

const decrire = (textes: Texte[]) => textes.map(t => `<${t.balise}> ${t.taille} px : « ${t.texte} »`)

for (const largeur of [320, 375, 1440]) {
  test.describe(`à ${largeur} px de large`, () => {
    test.use({ viewport: { width: largeur, height: 900 } })

    test("aucun texte n'est affiché sous 12 px, et le texte courant fait au moins 14 px", async ({ page }) => {
      await ouvrir(page)
      const textes = await mesurerLesTextes(page)
      expect(textes.length).toBeGreaterThan(200)
      expect(decrire(textes.filter(t => t.taille < 12)), "Textes de moins de 12 px").toEqual([])
      // Texte courant : un paragraphe ou un élément de liste de plus de 120 caractères.
      const courants = textes.filter(t => (t.balise === "p" || t.balise === "li") && t.longueur > 120)
      expect(courants.length).toBeGreaterThan(5)
      expect(decrire(courants.filter(t => t.taille < 14)), "Paragraphes de texte courant de moins de 14 px").toEqual([])
    })
  })
}
