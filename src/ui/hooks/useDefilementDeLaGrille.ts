// src/ui/hooks/useDefilementDeLaGrille.ts
// Suivi du défilement horizontal de la grille mensuelle, pour la bande des mois : la grille déborde-t-elle, quels
// mois se voient, est-on au début ou à la fin. Mesuré au défilement (une fois par image) et quand la grille change de
// taille. La zone qui défile marque sa première colonne `data-colonne-fixe` et les en-têtes des mois `data-mois`.

import { useCallback, useEffect, useState, type RefObject } from "react"
import { aLaFin, auDebut, deborde, moisVisibles, type GeometrieDeLaGrille } from "@/lib/bande-des-mois"

export interface EtatDuDefilement {
  deborde: boolean
  visibles: number[]
  auDebut: boolean
  aLaFin: boolean
  colonneFixe: number
}

const ETAT_INITIAL: EtatDuDefilement = { deborde: false, visibles: [], auDebut: true, aLaFin: true, colonneFixe: 0 }

/** Mesure la zone qui défile ; `null` tant que la grille n'a pas ses douze mois. */
export function mesurerLaGrille(zone: HTMLElement): GeometrieDeLaGrille | null {
  const mois = Array.from(zone.querySelectorAll<HTMLElement>("[data-mois]"), cellule => ({ gauche: cellule.offsetLeft, largeur: cellule.offsetWidth }))
  if (mois.length !== 12) return null
  const colonneFixe = zone.querySelector<HTMLElement>("[data-colonne-fixe]")?.offsetWidth ?? 0
  return { defilement: zone.scrollLeft, largeurVisible: zone.clientWidth, largeurTotale: zone.scrollWidth, colonneFixe, mois }
}

function etatDe(g: GeometrieDeLaGrille): EtatDuDefilement {
  return { deborde: deborde(g), visibles: moisVisibles(g), auDebut: auDebut(g), aLaFin: aLaFin(g), colonneFixe: g.colonneFixe }
}

const memeEtat = (a: EtatDuDefilement, b: EtatDuDefilement) =>
  a.deborde === b.deborde && a.auDebut === b.auDebut && a.aLaFin === b.aLaFin && a.colonneFixe === b.colonneFixe && a.visibles.join() === b.visibles.join()

/** Défilement doux, sauf si l'utilisateur a demandé de réduire les animations. */
function comportement(): ScrollBehavior {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"
}

/**
 * @param zone La zone qui défile (absente tant qu'aucun acteur n'est saisi).
 * @param presente Vrai quand la zone est affichée : le suivi démarre alors.
 */
export function useDefilementDeLaGrille(zone: RefObject<HTMLElement | null>, presente: boolean) {
  const [etat, setEtat] = useState<EtatDuDefilement>(ETAT_INITIAL)

  useEffect(() => {
    const element = zone.current
    if (!presente || !element) return
    let image = 0
    const mesurer = () => {
      image = 0
      const g = mesurerLaGrille(element)
      if (!g) return
      const suivant = etatDe(g)
      setEtat(precedent => (memeEtat(precedent, suivant) ? precedent : suivant))
    }
    // Une seule mesure par image, si nombreux que soient les événements de défilement.
    const planifier = () => {
      if (image === 0) image = requestAnimationFrame(mesurer)
    }
    mesurer()
    element.addEventListener("scroll", planifier, { passive: true })
    const observateur = new ResizeObserver(planifier)
    observateur.observe(element)
    if (element.firstElementChild) observateur.observe(element.firstElementChild)
    return () => {
      element.removeEventListener("scroll", planifier)
      observateur.disconnect()
      cancelAnimationFrame(image)
    }
  }, [zone, presente])

  /** Fait défiler la zone jusqu'à la position calculée sur sa géométrie actuelle. */
  const defiler = useCallback(
    (calcul: (g: GeometrieDeLaGrille) => number, immediat = false) => {
      const element = zone.current
      const g = element && mesurerLaGrille(element)
      if (!element || !g) return
      element.scrollTo({ left: calcul(g), behavior: immediat ? "instant" : comportement() })
    },
    [zone]
  )

  return { ...etat, defiler }
}
