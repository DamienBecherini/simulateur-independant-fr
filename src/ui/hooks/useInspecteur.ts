// src/ui/hooks/useInspecteur.ts
// Affichage « Panneaux » (proposition C de l'étude d'allègement de l'écran) : l'acteur dont le panneau est ouvert,
// et l'élément qui l'a ouvert, à qui le focus revient à la fermeture.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { avecActiviteComparee } from "@/lib/comparateur-options"
import type { Comparateur } from "@/types"

/** Identifiant du panneau, cible de `aria-controls` des boutons qui l'ouvrent. */
export const ID_DU_PANNEAU = "panneau-acteur"
/** Titre de la liste des acteurs : il reçoit le focus quand l'élément qui a ouvert le panneau a disparu. */
export const ID_DU_TITRE_DES_ACTEURS = "acteurs-titre"

export interface Inspecteur {
  /** Acteur dont le panneau est ouvert ; `null` quand il est fermé. */
  acteurOuvert: string | null
  /** Ouvre le panneau d'un acteur, ou le referme si c'est déjà le sien ; le focus reviendra à `invocateur`. */
  basculer: (id: string, invocateur: HTMLElement) => void
  /** Ferme le panneau et rend le focus à l'élément qui l'a ouvert. */
  fermer: () => void
}

export const InspecteurContext = createContext<Inspecteur | null>(null)

/** Le panneau des acteurs ; `null` hors de l'affichage « Panneaux » : les noms d'acteurs n'y ouvrent rien. */
export function useInspecteur(): Inspecteur | null {
  return useContext(InspecteurContext)
}

/** Rend le focus à l'élément qui a ouvert le panneau, ou, s'il a disparu, au titre de la liste des acteurs. */
function rendreLeFocus(invocateur: HTMLElement | null) {
  const cible = invocateur?.isConnected ? invocateur : document.getElementById(ID_DU_TITRE_DES_ACTEURS)
  cible?.focus()
}

/**
 * État du panneau. L'acteur choisi ne dépend pas de l'année affichée : les acteurs sont communs à toutes. Le panneau
 * se ferme si l'acteur disparaît (supprimé, ou ajout annulé) ou si l'on quitte l'affichage « Panneaux ». `null` hors
 * de cet affichage.
 */
export function useEtatDeLInspecteur(idsDesActeurs: readonly string[], actif: boolean): Inspecteur | null {
  const [choisi, setChoisi] = useState<string | null>(null)
  const invocateur = useRef<HTMLElement | null>(null)
  const acteurOuvert = actif && choisi !== null && idsDesActeurs.includes(choisi) ? choisi : null

  const fermer = useCallback(() => {
    setChoisi(null)
    rendreLeFocus(invocateur.current)
    invocateur.current = null
  }, [])

  const basculer = useCallback(
    (id: string, element: HTMLElement) => {
      if (id === acteurOuvert) {
        fermer()
        return
      }
      invocateur.current = element
      setChoisi(id)
    },
    [acteurOuvert, fermer]
  )

  // Panneau fermé de lui-même : le focus, resté dans le panneau retiré, revient à la page.
  useEffect(() => {
    if (choisi === null || acteurOuvert !== null) return
    setChoisi(null)
    if (document.activeElement === null || document.activeElement === document.body) rendreLeFocus(invocateur.current)
    invocateur.current = null
  }, [choisi, acteurOuvert])

  return useMemo(() => (actif ? { acteurOuvert, basculer, fermer } : null), [actif, acteurOuvert, basculer, fermer])
}

/** « Comparer ses statuts » : choisit l'activité dans le comparateur, puis y mène, focus compris. */
export function useComparerLesStatuts(setComparateur: (modifier: (comparateur: Comparateur | undefined) => Comparateur) => void) {
  return useCallback(
    (activiteId: string) => {
      setComparateur(comparateur => avecActiviteComparee(comparateur, activiteId))
      // Après le rendu du comparateur sur cette activité ; le défilement s'arrête sous la barre de résumé.
      requestAnimationFrame(() => {
        const titre = document.getElementById("comparateur-titre")
        titre?.scrollIntoView({ block: "start" })
        titre?.focus({ preventScroll: true })
      })
    },
    [setComparateur]
  )
}
