// src/ui/hooks/useListeAnimee.ts
// Une liste dont les éléments arrivent, partent et changent de place en douceur (un flux du mois, un acteur ajouté ou
// retiré, sa ligne dans la grille) : les voisins glissent à leur nouvelle place au lieu de sauter. Rien ne bouge si le système demande moins
// d'animations (la bibliothèque le respecte d'elle-même).

import autoAnimate, { type AnimationController } from "@formkit/auto-animate"
import type { DragEndEvent } from "@dnd-kit/core"
import { useCallback, useMemo, useRef, type RefObject } from "react"

const ANIMATION = { duration: 200, easing: "ease-out" } as const

const moinsDAnimations = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

/**
 * Quand le conteneur change de hauteur sans qu'un enfant arrive ni parte (une case de la grille qui passe de
 * « + Ajouter » à des barres, ou l'inverse) : les enfants qui ont bougé glissent de leur ancienne place à la nouvelle,
 * et le conteneur va de son ancienne hauteur à la nouvelle. Les arrivées et départs restent à la bibliothèque, et
 * un changement de largeur (fenêtre, zoom) ne s'anime pas. Renvoie de quoi arrêter.
 */
function glisserAuRedimensionnement(conteneur: HTMLElement): () => void {
  const positions = new Map<Element, number>()
  let largeur = conteneur.offsetWidth
  let hauteur = conteneur.offsetHeight
  let arriveesOuDeparts = false
  const relever = () => {
    positions.clear()
    for (const enfant of conteneur.children) if (enfant instanceof HTMLElement) positions.set(enfant, enfant.offsetTop)
    largeur = conteneur.offsetWidth
    hauteur = conteneur.offsetHeight
  }
  /** Lance les glissements depuis les places relevées ; mesure tout avant d'animer (une hauteur animée fausserait la mesure). */
  const glisser = () => {
    const anciennes = new Map(positions)
    const ancienneHauteur = hauteur
    relever()
    for (const [enfant, nouvelle] of positions) {
      const avant = anciennes.get(enfant)
      if (avant !== undefined && avant !== nouvelle) enfant.animate([{ transform: `translateY(${avant - nouvelle}px)` }, { transform: "none" }], ANIMATION)
    }
    conteneur.animate([{ height: `${ancienneHauteur}px` }, { height: `${hauteur}px` }], ANIMATION)
  }
  relever()
  const mutations = new MutationObserver(() => {
    arriveesOuDeparts = true
  })
  mutations.observe(conteneur, { childList: true })
  const tailles = new ResizeObserver(() => {
    // La hauteur animée par la bibliothèque, ou par ce glissement, rappelle l'observateur : seule compte la hauteur du contenu.
    if (conteneur.getAnimations().length > 0 && !arriveesOuDeparts) return
    const aGlisser = !arriveesOuDeparts && conteneur.offsetWidth === largeur && conteneur.offsetHeight !== hauteur && !moinsDAnimations()
    arriveesOuDeparts = false
    if (aGlisser) glisser()
    else relever()
  })
  tailles.observe(conteneur)
  return () => {
    mutations.disconnect()
    tailles.disconnect()
  }
}

/** Désigne l'élément de la liste (hors du hook : le compilateur de React n'y voit pas une modification de ses arguments). */
function designer<T extends HTMLElement>(liste: RefObject<T | null> | undefined, element: T | null) {
  if (liste) liste.current = element
}

/**
 * Renvoie la `ref` du conteneur dont les enfants directs sont les éléments de la liste (`liste` le désigne aussi, pour
 * le faire défiler), et les rappels d'un glisser-déposer éventuel (`onDragEnd`) : dnd-kit anime lui-même l'élément déplacé, l'animation de la
 * liste s'efface le temps du geste et reprend une fois le nouvel ordre affiché. Sans animations Web (jsdom, très vieux
 * navigateur), la liste reste simplement sans animation. `suivreLesHauteurs` : les enfants glissent aussi quand l'un
 * d'eux change de hauteur (les cases d'une grille).
 */
export function useListeAnimee<T extends HTMLElement = HTMLDivElement>(onDragEnd?: (event: DragEndEvent) => void, liste?: RefObject<T | null>, suivreLesHauteurs = false) {
  const controleur = useRef<AnimationController | null>(null)
  const ref = useCallback(
    (element: T | null) => {
      designer(liste, element)
      const animation = element && typeof element.animate === "function" ? autoAnimate(element, ANIMATION) : null
      controleur.current = animation
      const arreterLeGlissement = element && animation && suivreLesHauteurs ? glisserAuRedimensionnement(element) : null
      return () => {
        arreterLeGlissement?.()
        animation?.destroy?.()
        controleur.current = null
        designer(liste, null)
      }
    },
    [liste, suivreLesHauteurs]
  )
  const glisser = useMemo(() => {
    const reprendre = () => requestAnimationFrame(() => controleur.current?.enable())
    return {
      onDragStart: () => controleur.current?.disable(),
      onDragCancel: reprendre,
      onDragEnd: (event: DragEndEvent) => {
        onDragEnd?.(event)
        reprendre()
      }
    }
  }, [onDragEnd])
  return [ref, glisser] as const
}
