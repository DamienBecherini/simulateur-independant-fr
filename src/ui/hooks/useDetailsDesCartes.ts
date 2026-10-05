// src/ui/hooks/useDetailsDesCartes.ts
// Détail des cartes de résultats : un seul état pour toutes les cartes (foyers fiscaux et activités), pour qu'un clic
// sur « Afficher le détail » de n'importe quelle carte les déplie toutes d'un coup. Le bouton cliqué garde sa place à
// l'écran et le focus, quelle que soit la hauteur gagnée ou perdue au-dessus de lui. L'état est retenu dans les
// préférences de l'utilisateur (voir useSectionOuverte).

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef } from "react"
import { useAffichageResume } from "./useAffichage"
import { useSectionOuverte } from "./useSectionOuverte"

/** Identifiant sous lequel l'état du détail des cartes est retenu. */
export const ID_DU_DETAIL_DES_CARTES = "details-des-cartes"

/**
 * Détail des cartes, retenu dans les préférences : ouvert d'office dans l'affichage classique (la page d'origine, tout
 * affiché), fermé dans les affichages qui replient le détail, tant que l'utilisateur n'a pas choisi.
 */
export function useEtatDuDetail(): [boolean, (ouvert: boolean) => void] {
  return useSectionOuverte(ID_DU_DETAIL_DES_CARTES, !useAffichageResume())
}

/** Classes du détail fermé d'une carte : masqué à l'écran quand il est fermé, toujours imprimé. */
export function classeDuDetail(ouvert: boolean, imprime: "block" | "flex" = "block"): string | undefined {
  if (ouvert) return undefined
  return imprime === "flex" ? "hidden print:flex" : "hidden print:block"
}

/** Position d'un élément dans la fenêtre, à retrouver après la mise en page. */
interface Ancre {
  element: HTMLElement
  haut: number
}

/**
 * Remet l'élément à la hauteur où il était dans la fenêtre, en faisant défiler la page d'autant que la mise en page
 * l'a déplacé ; sans défilement animé (préférence « réduire les animations » comprise). Deux passes au plus : avec
 * un zoom de l'interface, un défilement peut ne pas déplacer l'élément d'exactement la distance demandée.
 */
export function retrouverLaPosition({ element, haut }: Ancre) {
  for (let passe = 0; passe < 2; passe++) {
    const ecart = element.getBoundingClientRect().top - haut
    if (Math.abs(ecart) < 0.5) break
    window.scrollBy({ top: ecart, behavior: "instant" })
  }
  if (element.isConnected && document.activeElement !== element) element.focus({ preventScroll: true })
}

export interface DetailsDesCartes {
  ouvert: boolean
  /** Ouvre ou ferme le détail de toutes les cartes ; `bouton`, l'élément cliqué, garde sa place dans la fenêtre et le focus. */
  basculer: (ouvert: boolean, bouton: HTMLElement) => void
}

export const DetailsDesCartesContext = createContext<DetailsDesCartes | null>(null)

/** État partagé du détail, et l'ancrage du défilement après chaque bascule. */
export function useDetailsDesCartes(): DetailsDesCartes {
  const [ouvert, changer] = useEtatDuDetail()
  const ancre = useRef<Ancre | null>(null)

  // Après la mise à jour du DOM, avant l'affichage : le bouton cliqué reprend sa place, sans saut visible.
  useLayoutEffect(() => {
    const aRetrouver = ancre.current
    ancre.current = null
    if (aRetrouver) retrouverLaPosition(aRetrouver)
  }, [ouvert])

  const basculer = useCallback(
    (ouvrir: boolean, bouton: HTMLElement) => {
      ancre.current = { element: bouton, haut: bouton.getBoundingClientRect().top }
      changer(ouvrir)
    },
    [changer]
  )
  return useMemo(() => ({ ouvert, basculer }), [ouvert, basculer])
}

/** Le contexte des détails, s'il en existe un plus haut dans l'arbre. */
export function useDetailsDesCartesExistants(): DetailsDesCartes | null {
  return useContext(DetailsDesCartesContext)
}

/** Détail des cartes, partagé par toutes (voir useEtatDuDetail pour l'état par défaut). */
export function useDetailDesCartes(): { ouvert: boolean; basculer: (bouton: HTMLElement) => void } {
  const details = useContext(DetailsDesCartesContext)
  const resume = useAffichageResume()
  const ouvert = details?.ouvert ?? !resume
  return { ouvert, basculer: bouton => details?.basculer(!ouvert, bouton) }
}
