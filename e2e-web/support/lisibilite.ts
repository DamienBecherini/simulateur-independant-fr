// e2e-web/support/lisibilite.ts
// Ce qui rend un écran illisible quand on agrandit l'interface (boutons de zoom) ou qu'on rétrécit la fenêtre : un texte
// qui sort de l'écran sans qu'on puisse y défiler, un texte coupé par son cadre, un texte trop petit. Le relevé se fait
// dans la page, sur ce qui est affiché ; chaque défaut est décrit en une ligne, pour que l'échec d'un test se lise seul.

import type { Locator, Page } from "@playwright/test"

/** Taille minimale d'un texte à l'écran, en pixels réels : celle du plus petit texte de l'interface au zoom par défaut. */
const TAILLE_MINIMALE = 12

/**
 * Les défauts de lisibilité de ce qui est affiché dans `racine` (la page entière par défaut) :
 * - « hors de l'écran » : un texte ou une commande visible (bouton, lien, champ) dépasse le bord gauche ou droit de la
 *   fenêtre, hors d'une zone qui défile en largeur (tableau, grille) : on ne peut pas l'atteindre ;
 * - « coupé » : un cadre qui masque ce qui dépasse (overflow hidden ou clip) contient plus large ou plus haut que lui,
 *   sauf troncature voulue (classe `truncate`, points de suspension, limite de lignes) ;
 * - « trop petit » : un texte de moins de 12 px réels, zoom compris.
 * Les textes réservés aux lecteurs d'écran (sr-only) et les éléments masqués sont ignorés.
 */
export async function defautsDeLisibilite(page: Page, racine?: Locator): Promise<string[]> {
  const cible = racine ?? page.locator("body")
  return cible.evaluate((element, tailleMinimale) => {
    const zoom = Number.parseFloat(getComputedStyle(document.body).zoom) || 1
    const largeur = window.innerWidth
    const defauts = new Set<string>()
    const extrait = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50)
    const visible = (el: Element) => {
      const style = getComputedStyle(el)
      if (style.visibility === "hidden" || style.display === "none" || Number.parseFloat(style.opacity) === 0) return false
      const cadre = el.getBoundingClientRect()
      return cadre.width > 1 && cadre.height > 1
    }
    const reserveAuxLecteursDEcran = (el: Element) => el.closest(".sr-only") !== null
    /** L'élément est dans une zone qui défile en largeur : ce qui en dépasse s'atteint en défilant. */
    const defileEnLargeur = (el: Element) => {
      for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const { overflowX } = getComputedStyle(parent)
        if ((overflowX === "auto" || overflowX === "scroll") && parent.scrollWidth > parent.clientWidth + 1) return true
      }
      return false
    }
    /** Dans une fenêtre de dialogue ou un panneau ouvert : seul ce qu'ils contiennent compte, le reste est derrière. */
    const derriereUneFenetre = (el: Element) => document.querySelector("[role='dialog']") !== null && el.closest("[role='dialog'], [data-sonner-toaster]") === null && element === document.body

    const tous = [element, ...Array.from(element.querySelectorAll("*"))]
    for (const el of tous) {
      if (!(el instanceof HTMLElement) || reserveAuxLecteursDEcran(el) || !visible(el) || derriereUneFenetre(el)) continue
      const style = getComputedStyle(el)
      const porteDuTexte = Array.from(el.childNodes).some(noeud => noeud.nodeType === Node.TEXT_NODE && (noeud.textContent ?? "").trim() !== "")

      // Un bouton réduit à son icône ne porte pas de texte : on le nomme par son nom accessible.
      const commande = el.matches("button, a[href], input, select, textarea, [role='switch'], [role='combobox'], [role='tab'], summary")
      if (porteDuTexte || commande) {
        const cadre = el.getBoundingClientRect()
        const nom = extrait(el) || el.getAttribute("aria-label") || el.tagName.toLowerCase()
        if ((cadre.right > largeur + 1 || cadre.left < -1) && !defileEnLargeur(el)) defauts.add(`hors de l'écran (${Math.round(cadre.left)} à ${Math.round(cadre.right)} px pour ${largeur}) : « ${nom} »`)
      }
      if (porteDuTexte) {
        const taille = Number.parseFloat(style.fontSize) * zoom
        if (taille < tailleMinimale - 0.01) defauts.add(`trop petit (${taille.toFixed(1)} px) : « ${extrait(el)} »`)
      }

      const masque = (valeur: string) => valeur === "hidden" || valeur === "clip"
      const troncatureVoulue = style.textOverflow === "ellipsis" || style.getPropertyValue("-webkit-line-clamp") !== "none"
      if (!troncatureVoulue && extrait(el) !== "") {
        if (masque(style.overflowX) && el.scrollWidth > el.clientWidth + 1) defauts.add(`coupé en largeur (${el.scrollWidth} px dans ${el.clientWidth}) : « ${extrait(el)} »`)
        if (masque(style.overflowY) && el.scrollHeight > el.clientHeight + 1) defauts.add(`coupé en hauteur (${el.scrollHeight} px dans ${el.clientHeight}) : « ${extrait(el)} »`)
      }
    }
    return [...defauts]
  }, TAILLE_MINIMALE)
}
