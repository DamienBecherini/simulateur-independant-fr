// src/ui/hooks/useDetailsDesCartes.ts
// Détail des cartes de résultats : un seul état par groupe de cartes (les foyers fiscaux, les activités), pour qu'un
// clic sur « Afficher le détail » d'une carte déplie tout le groupe d'un coup. Le bouton cliqué garde sa place à
// l'écran et le focus, quelle que soit la hauteur gagnée ou perdue au-dessus de lui.

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useAffichageResume } from "./useAffichage"

export type GroupeDeCartes = "foyers" | "activites"

/** Détail ouvert ou fermé de chaque groupe ; `null` tant que l'utilisateur n'a rien choisi : l'affichage décide. */
export type EtatDesGroupes = Record<GroupeDeCartes, boolean | null>

/**
 * État des groupes, seul et à part : il pourra être retenu dans les préférences de l'utilisateur sans rien changer
 * aux cartes ni aux boutons.
 */
export function useEtatDesGroupes(): [EtatDesGroupes, (groupe: GroupeDeCartes, ouvert: boolean) => void] {
  const [etat, setEtat] = useState<EtatDesGroupes>({ foyers: null, activites: null })
  const changer = useCallback((groupe: GroupeDeCartes, ouvert: boolean) => setEtat(actuel => ({ ...actuel, [groupe]: ouvert })), [])
  return [etat, changer]
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
  etat: EtatDesGroupes
  /** Ouvre ou ferme le détail de tout le groupe ; `bouton`, l'élément cliqué, garde sa place dans la fenêtre et le focus. */
  basculer: (groupe: GroupeDeCartes, ouvert: boolean, bouton: HTMLElement) => void
}

export const DetailsDesCartesContext = createContext<DetailsDesCartes | null>(null)

/** État partagé des groupes, et l'ancrage du défilement après chaque bascule. */
export function useDetailsDesCartes(): DetailsDesCartes {
  const [etat, changer] = useEtatDesGroupes()
  const ancre = useRef<Ancre | null>(null)

  // Après la mise à jour du DOM, avant l'affichage : le bouton cliqué reprend sa place, sans saut visible.
  useLayoutEffect(() => {
    const aRetrouver = ancre.current
    ancre.current = null
    if (aRetrouver) retrouverLaPosition(aRetrouver)
  }, [etat])

  const basculer = useCallback(
    (groupe: GroupeDeCartes, ouvert: boolean, bouton: HTMLElement) => {
      ancre.current = { element: bouton, haut: bouton.getBoundingClientRect().top }
      changer(groupe, ouvert)
    },
    [changer]
  )
  return useMemo(() => ({ etat, basculer }), [etat, basculer])
}

/** Le contexte des détails, s'il en existe un plus haut dans l'arbre. */
export function useDetailsDesCartesExistants(): DetailsDesCartes | null {
  return useContext(DetailsDesCartesContext)
}

/**
 * Détail d'un groupe de cartes : ouvert d'office dans l'affichage classique (la page d'origine, tout affiché), fermé
 * dans les affichages qui replient le détail, tant que l'utilisateur n'a pas choisi.
 */
export function useDetailDuGroupe(groupe: GroupeDeCartes): { ouvert: boolean; basculer: (bouton: HTMLElement) => void } {
  const details = useContext(DetailsDesCartesContext)
  const resume = useAffichageResume()
  const ouvert = details?.etat[groupe] ?? !resume
  return { ouvert, basculer: bouton => details?.basculer(groupe, !ouvert, bouton) }
}
