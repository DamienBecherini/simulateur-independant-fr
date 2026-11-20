// e2e-web/support/lisibilite.ts
// Ce qui rend un écran illisible quand on agrandit l'interface (boutons de zoom) ou qu'on rétrécit la fenêtre : un texte
// qui sort de l'écran sans qu'on puisse y défiler, un texte coupé par son cadre, un texte trop petit, deux textes écrits
// l'un sur l'autre. Le relevé se fait dans la page, sur ce qui est affiché ; chaque défaut est décrit en une ligne, pour
// que l'échec d'un test se lise seul.

import { expect, type Locator, type Page } from "@playwright/test"

/** Taille minimale d'un texte à l'écran, en pixels réels : celle du plus petit texte de l'interface au zoom par défaut. */
const TAILLE_MINIMALE = 12

/**
 * Les défauts de lisibilité de ce qui est affiché dans `racine` (la page entière par défaut) :
 * - « hors de l'écran » : un texte ou une commande visible (bouton, lien, champ) dépasse le bord gauche ou droit de la
 *   fenêtre, hors d'une zone qui défile en largeur (tableau, grille) : on ne peut pas l'atteindre ;
 * - « coupé » : un cadre qui masque ce qui dépasse (overflow hidden ou clip) contient plus large ou plus haut que lui,
 *   sauf troncature voulue (classe `truncate`, points de suspension, limite de lignes) ;
 * - « trop petit » : un texte de moins de 12 px réels, zoom compris ;
 * - « chevauchement » : deux textes écrits l'un sur l'autre. On compare les lignes de texte elles-mêmes (pas les cadres
 *   de leurs éléments), réduites à ce que leurs zones de défilement en laissent voir. Deux textes ne se gênent que dans
 *   une même couche : celui d'une barre collée ou fixe (en-tête de tableau, barre d'outils) passe devant ce qui défile
 *   dessous, ce n'est pas un défaut ;
 * - « déborde de son cadre » : une ligne de texte sort, à gauche ou à droite, du cadre dessiné qui la porte (carte,
 *   bouton, encadré : une bordure ou un fond), faute de place pour un mot ou un montant insécable.
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

    // --- Chevauchement : les lignes de texte affichées, avec la couche qui les porte.
    interface Ligne {
      el: HTMLElement
      gauche: number
      haut: number
      droite: number
      bas: number
      couche: Element | null
    }
    const lignes: Ligne[] = []
    const masque = (valeur: string) => valeur !== "visible"
    /** La couleur se voit : son opacité, écrite `rgba(r, v, b, a)` ou `… / a)`, n'est pas nulle. */
    const opaque = (couleur: string) => {
      const opacite = /\/\s*([\d.]+%?)\s*\)$/.exec(couleur) ?? /^rgba\((?:[^,]+,){3}\s*([\d.]+)\s*\)$/.exec(couleur)
      return opacite ? Number.parseFloat(opacite[1]) > 0 : couleur !== "transparent"
    }
    /** L'élément dessine un cadre : une bordure sur un côté, ou un fond. */
    const dessine = (style: CSSStyleDeclaration) =>
      (style.borderLeftStyle !== "none" && Number.parseFloat(style.borderLeftWidth) > 0 && opaque(style.borderLeftColor)) || (style.borderRightStyle !== "none" && Number.parseFloat(style.borderRightWidth) > 0 && opaque(style.borderRightColor)) || opaque(style.backgroundColor) || style.backgroundImage !== "none"
    /** Ce que les ancêtres de `el` laissent voir du cadre, et la barre collée ou fixe qui le porte, s'il y en a une. */
    const releverLesLignes = (el: HTMLElement) => {
      // Ancêtre invisible (opacité nulle, contenu d'une section repliée) : rien n'est affiché.
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return
      let couche: Element | null = null
      // Le cadre dessiné le plus proche (carte, bouton, encadré), tant qu'aucune zone qui masque ou défile ne s'interpose.
      let cadreDessine: DOMRect | null | undefined
      const cadres: DOMRect[] = []
      for (let parent: Element | null = el; parent && parent !== document.documentElement; parent = parent.parentElement) {
        const style = getComputedStyle(parent)
        if (couche === null && (style.position === "fixed" || style.position === "sticky")) couche = parent
        // L'élément lui-même borne son texte s'il masque ce qui dépasse (un nom tronqué par des points de suspension).
        const limite = masque(style.overflowX) || masque(style.overflowY)
        if (limite) cadres.push(parent.getBoundingClientRect())
        if (cadreDessine === undefined && parent !== document.body) {
          if (limite) cadreDessine = null
          else if (dessine(style)) cadreDessine = parent.getBoundingClientRect()
        }
      }
      const etendue = document.createRange()
      for (const noeud of Array.from(el.childNodes)) {
        if (noeud.nodeType !== Node.TEXT_NODE || (noeud.textContent ?? "").trim() === "") continue
        etendue.selectNodeContents(noeud)
        for (const cadre of Array.from(etendue.getClientRects())) {
          let { left: gauche, top: haut, right: droite, bottom: bas } = cadre
          for (const limite of cadres) {
            gauche = Math.max(gauche, limite.left)
            haut = Math.max(haut, limite.top)
            droite = Math.min(droite, limite.right)
            bas = Math.min(bas, limite.bottom)
          }
          if (droite - gauche <= 1 || bas - haut <= 1) continue
          lignes.push({ el, gauche, haut, droite, bas, couche })
          if (!cadreDessine) continue
          const depassement = Math.max(droite - cadreDessine.right, cadreDessine.left - gauche)
          // En largeur seulement : en hauteur, une étiquette posée exprès au-dessus de son repère (le nombre de flux
          // au-dessus d'une barre de la grille) sort de son cadre sans gêner, et un vrai débordement recouvre le texte voisin.
          if (depassement > 2) defauts.add(`déborde de son cadre (de ${Math.round(depassement)} px) : « ${extrait(el)} »`)
        }
      }
    }

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
        releverLesLignes(el)
      }

      const coupe = (valeur: string) => valeur === "hidden" || valeur === "clip"
      const troncatureVoulue = style.textOverflow === "ellipsis" || style.getPropertyValue("-webkit-line-clamp") !== "none"
      if (!troncatureVoulue && extrait(el) !== "") {
        if (coupe(style.overflowX) && el.scrollWidth > el.clientWidth + 1) defauts.add(`coupé en largeur (${el.scrollWidth} px dans ${el.clientWidth}) : « ${extrait(el)} »`)
        if (coupe(style.overflowY) && el.scrollHeight > el.clientHeight + 1) defauts.add(`coupé en hauteur (${el.scrollHeight} px dans ${el.clientHeight}) : « ${extrait(el)} »`)
      }
    }

    // Deux lignes de deux éléments différents, dans la même couche, qui se recouvrent nettement : plus de 2 px en largeur
    // et plus du tiers de la plus basse des deux en hauteur (deux lignes serrées se touchent d'un pixel ou deux).
    lignes.sort((a, b) => a.haut - b.haut)
    for (let i = 0; i < lignes.length; i++) {
      const a = lignes[i]
      for (let j = i + 1; j < lignes.length && lignes[j].haut < a.bas; j++) {
        const b = lignes[j]
        if (a.el === b.el || a.couche !== b.couche) continue
        const enLargeur = Math.min(a.droite, b.droite) - Math.max(a.gauche, b.gauche)
        const enHauteur = Math.min(a.bas, b.bas) - b.haut
        if (enLargeur > 2 && enHauteur > Math.min(a.bas - a.haut, b.bas - b.haut) / 3) defauts.add(`chevauchement (${Math.round(enLargeur)} × ${Math.round(enHauteur)} px) : « ${extrait(a.el)} » et « ${extrait(b.el)} »`)
      }
    }
    return [...defauts]
  }, TAILLE_MINIMALE)
}

/**
 * Ce qui ne va pas dans la fenêtre ouverte, une fois son animation d'ouverture finie : un bord hors de l'écran, ou un
 * défaut de lisibilité. Chaque ligne commence par le nom de la fenêtre.
 */
export async function defautsDeLaFenetre(page: Page, fenetre: Locator, taille: { largeur: number; hauteur: number }, nom: string): Promise<string[]> {
  await expect(fenetre, nom).toBeVisible()
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
  const bords = [
    cadre.x < -1 ? "bord gauche hors de l'écran" : "",
    cadre.y < -1 ? "bord haut hors de l'écran" : "",
    cadre.x + cadre.width > taille.largeur + 1 ? `bord droit hors de l'écran (${Math.round(cadre.x + cadre.width)} px pour ${taille.largeur})` : "",
    cadre.y + cadre.height > taille.hauteur + 1 ? `bord bas hors de l'écran (${Math.round(cadre.y + cadre.height)} px pour ${taille.hauteur})` : ""
  ]
  return [...bords.filter(Boolean), ...(await defautsDeLisibilite(page, fenetre))].map(defaut => `${nom} : ${defaut}`)
}
