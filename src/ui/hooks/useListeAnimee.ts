// src/ui/hooks/useListeAnimee.ts
// Une liste dont les éléments arrivent, partent et changent de place en douceur (un flux du mois, un acteur ajouté ou
// retiré, sa ligne dans la grille) : les voisins glissent à leur nouvelle place au lieu de sauter. Rien ne bouge si le système demande moins
// d'animations (la bibliothèque le respecte d'elle-même).

import autoAnimate, { type AnimationController } from "@formkit/auto-animate"
import type { DragEndEvent } from "@dnd-kit/core"
import { useCallback, useMemo, useRef, type RefObject } from "react"

const ANIMATION = { duration: 200, easing: "ease-out" } as const

/** Désigne l'élément de la liste (hors du hook : le compilateur de React n'y voit pas une modification de ses arguments). */
function designer(liste: RefObject<HTMLDivElement | null> | undefined, element: HTMLDivElement | null) {
  if (liste) liste.current = element
}

/**
 * Renvoie la `ref` du conteneur dont les enfants directs sont les éléments de la liste (`liste` le désigne aussi, pour
 * le faire défiler), et les rappels d'un glisser-déposer éventuel (`onDragEnd`) : dnd-kit anime lui-même l'élément déplacé, l'animation de la
 * liste s'efface le temps du geste et reprend une fois le nouvel ordre affiché. Sans animations Web (jsdom, très vieux
 * navigateur), la liste reste simplement sans animation.
 */
export function useListeAnimee(onDragEnd?: (event: DragEndEvent) => void, liste?: RefObject<HTMLDivElement | null>) {
  const controleur = useRef<AnimationController | null>(null)
  const ref = useCallback(
    (element: HTMLDivElement | null) => {
      designer(liste, element)
      const animation = element && typeof element.animate === "function" ? autoAnimate(element, ANIMATION) : null
      controleur.current = animation
      return () => {
        animation?.destroy?.()
        controleur.current = null
        designer(liste, null)
      }
    },
    [liste]
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
